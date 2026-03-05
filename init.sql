-- AgentRecall Database Initialization Script
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. pitfalls 表：存储避坑指南（核心表）
CREATE TABLE IF NOT EXISTS pitfalls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern TEXT NOT NULL,                    -- 错误模式描述
    workaround TEXT NOT NULL,                 -- 解决方案
    embedding VECTOR(1024),                   -- 向量嵌入（OpenAI text-embedding-3-small 或本地模型）
    taxonomy JSONB DEFAULT '{}',              -- 分类标签（如 {"category": "api", "severity": "high"}）
    context_fingerprint TEXT,                 -- 上下文指纹（用于相似性匹配）
    error_signature TEXT,                     -- 错误签名（哈希）
    instance_id UUID,                         -- 提交实例ID
    submission_count INTEGER DEFAULT 1,       -- 被提交次数（去重统计）
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建 IVFFlat 索引用于向量相似度搜索（余弦距离）
CREATE INDEX IF NOT EXISTS idx_pitfalls_embedding_ivfflat 
ON pitfalls USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- 创建其他常用索引
CREATE INDEX IF NOT EXISTS idx_pitfalls_error_signature ON pitfalls(error_signature);
CREATE INDEX IF NOT EXISTS idx_pitfalls_context_fingerprint ON pitfalls(context_fingerprint);
CREATE INDEX IF NOT EXISTS idx_pitfalls_taxonomy ON pitfalls USING GIN(taxonomy);
CREATE INDEX IF NOT EXISTS idx_pitfalls_created_at ON pitfalls(created_at DESC);

-- 创建更新时间戳触发器
CREATE TRIGGER update_pitfalls_updated_at
    BEFORE UPDATE ON pitfalls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

    pitfall_id UUID REFERENCES pitfalls(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,              -- 动作类型: submit, query, activate
    ip_address INET,                          -- IP 地址（用于限流统计）
    user_agent TEXT,                          -- User-Agent
    request_payload JSONB,                    -- 请求内容（脱敏后）
    response_status INTEGER,                  -- 响应状态码
    processing_time_ms INTEGER,               -- 处理时间（毫秒）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_submissions_instance ON submissions(instance_id);
CREATE INDEX IF NOT EXISTS idx_submissions_action ON submissions(action);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_ip_action ON submissions(ip_address, action, created_at);

-- 5. rate_limit_logs 表：限流记录（用于统计和调试）
CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,                 -- 限流标识（IP 或 instance_id）
    limit_type VARCHAR(50) NOT NULL,          -- 限流类型: register, activate, submit, query
    current_count INTEGER NOT NULL,           -- 当前请求数
    limit_count INTEGER NOT NULL,             -- 限制数
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_identifier ON rate_limit_logs(identifier, limit_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_created_at ON rate_limit_logs(created_at DESC);

-- 创建用于向量相似度搜索的函数
CREATE OR REPLACE FUNCTION search_similar_pitfalls(
    query_embedding VECTOR(1024),
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    pattern TEXT,
    workaround TEXT,
    taxonomy JSONB,
    similarity FLOAT,
    submission_count INTEGER,
    last_seen_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.pattern,
        p.workaround,
        p.taxonomy,
        1 - (p.embedding <=> query_embedding) AS similarity,
        p.submission_count,
        p.last_seen_at
    FROM pitfalls p
    WHERE p.embedding IS NOT NULL
      AND 1 - (p.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- 创建用于获取社区统计的函数
CREATE OR REPLACE FUNCTION get_community_stats()
RETURNS TABLE (
    total_pitfalls BIGINT,
        (SELECT COUNT(*) FROM submissions) AS total_submissions,
        (SELECT COUNT(*) FROM submissions WHERE created_at >= CURRENT_DATE) AS today_submissions,
        (SELECT COUNT(DISTINCT error_signature) FROM pitfalls WHERE error_signature IS NOT NULL) AS unique_error_patterns;
END;
$$ LANGUAGE plpgsql;

-- 创建用于去重提交的函数（如果相同 error_signature 已存在，则更新计数）
CREATE OR REPLACE FUNCTION upsert_pitfall(
    p_pattern TEXT,
    p_workaround TEXT,
    p_embedding VECTOR(1024),
    p_taxonomy JSONB DEFAULT '{}',
    p_context_fingerprint TEXT DEFAULT NULL,
    p_error_signature TEXT DEFAULT NULL,
    p_instance_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, is_new BOOLEAN) AS $$
DECLARE
    v_id UUID;
    v_is_new BOOLEAN := FALSE;
BEGIN
    -- 尝试查找已存在的相同错误签名
    IF p_error_signature IS NOT NULL THEN
        SELECT pitfalls.id INTO v_id
        FROM pitfalls
        WHERE pitfalls.error_signature = p_error_signature
        LIMIT 1;
    END IF;
    
    IF v_id IS NOT NULL THEN
        -- 更新现有记录
        UPDATE pitfalls
        SET submission_count = submission_count + 1,
            last_seen_at = CURRENT_TIMESTAMP,
            workaround = CASE 
                WHEN LENGTH(p_workaround) > LENGTH(pitfalls.workaround) 
                THEN p_workaround 
                ELSE pitfalls.workaround 
            END
        WHERE pitfalls.id = v_id;
        v_is_new := FALSE;
    ELSE
        -- 插入新记录
        INSERT INTO pitfalls (
            pattern, workaround, embedding, taxonomy,
            context_fingerprint, error_signature, instance_id
        ) VALUES (
            p_pattern, p_workaround, p_embedding, p_taxonomy,
            p_context_fingerprint, p_error_signature, p_instance_id
        )
        RETURNING pitfalls.id INTO v_id;
        v_is_new := TRUE;
    END IF;
    
    RETURN QUERY SELECT v_id, v_is_new;
END;
$$ LANGUAGE plpgsql;

-- 插入测试数据（可选，用于验证）
-- INSERT INTO pitfalls (pattern, workaround, taxonomy) VALUES 
--     ('Test pattern 1', 'Test workaround 1', '{"category": "test", "severity": "low"}'),
--     ('Test pattern 2', 'Test workaround 2', '{"category": "test", "severity": "medium"}');

-- ============================================
-- 后台管理功能表
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    status VARCHAR(20) DEFAULT 'active',
    api_quota INTEGER DEFAULT 1000,
    api_used INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- API Keys 表
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    permissions JSONB DEFAULT '["read"]',
    rate_limit INTEGER DEFAULT 100,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- API 使用日志表
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    request_size INTEGER DEFAULT 0,
    response_size INTEGER DEFAULT 0,
    duration_ms INTEGER,
    client_ip INET,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_id ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at DESC);

-- 交互历史表
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    request_type VARCHAR(50) NOT NULL,
    request_payload JSONB NOT NULL,
    response_payload JSONB,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- 创建更新时间戳触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_configs_updated_at
    BEFORE UPDATE ON system_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建默认系统配置
INSERT INTO system_configs (config_key, config_value, description)
VALUES 
    ('default_api_quota', '1000', '默认用户 API 配额'),
    ('default_rate_limit', '100', '默认 API Key 速率限制(次/分钟)'),
    ('max_api_keys_per_user', '5', '每个用户最多 API Key 数量'),
    ('log_retention_days', '30', '日志保留天数'),
    ('enable_registration', 'true', '是否开放注册')
ON CONFLICT (config_key) DO NOTHING;
