# AgentRecall MCP Server - 数据量暴增扩展方案

## 概述

本文档描述当 AgentRecall 面临数据量暴增时的应对策略，包括：
- 数据分区与分片
- 读写分离
- 向量搜索优化
- 缓存策略
- 水平扩展

## 当前架构限制

### 单节点 PostgreSQL 瓶颈

| 指标 | 当前限制 | 预估瓶颈 |
|------|----------|----------|
| pitfalls 表 | 无分区 | ~1000万条后性能下降 |
| 向量搜索 | IVFFlat 索引 | 高并发时延迟增加 |
| 连接数 | max_connections=50 | 并发请求受限 |
| 存储 | 单盘 | I/O 瓶颈 |

### 单节点 Redis 瓶颈

| 指标 | 当前限制 | 预估瓶颈 |
|------|----------|----------|
| 内存 | 512MB | 限流数据可能被驱逐 |
| 单线程 | 单核 | 高并发时 CPU 饱和 |

## 扩展方案

### 阶段 1：垂直扩展（Vertical Scaling）

**适用场景**: 数据量 < 1000万条，QPS < 1000

#### 1.1 硬件升级

```yaml
# docker-compose.yml 升级配置
services:
  postgres:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
    # 使用 SSD 存储
    volumes:
      - postgres_data:/var/lib/postgresql/data:rw
      - /ssd/postgres_data:/var/lib/postgresql/data:rw
```

#### 1.2 PostgreSQL 参数优化

```conf
# postgresql.conf - 针对 8G 内存优化
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 64MB
maintenance_work_mem = 512MB
max_connections = 200

# WAL 优化
wal_buffers = 64MB
max_wal_size = 8GB
min_wal_size = 2GB

# 并行查询
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
```

#### 1.3 索引优化

```sql
-- 添加复合索引
CREATE INDEX CONCURRENTLY idx_pitfalls_taxonomy_gin 
ON pitfalls USING GIN(taxonomy jsonb_path_ops);

-- 分区表索引
CREATE INDEX CONCURRENTLY idx_pitfalls_created_at 
ON pitfalls(created_at DESC) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- 向量索引优化（增加 lists 数量）
DROP INDEX idx_pitfalls_embedding_ivfflat;
CREATE INDEX idx_pitfalls_embedding_ivfflat 
ON pitfalls USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 500);  -- 数据量增加时增加 lists
```

### 阶段 2：读写分离（Read/Write Splitting）

**适用场景**: 数据量 1000万-1亿条，读多写少

#### 2.1 主从复制架构

```yaml
# docker-compose.yml - 主从配置
version: '3.8'

services:
  postgres-primary:
    image: ankane/pgvector:latest
    container_name: agentrecall-db-primary
    environment:
      - POSTGRES_USER=agentrecall
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=agentrecall
    volumes:
      - postgres_primary_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    command: >
      postgres
      -c wal_level=replica
      -c max_wal_senders=10
      -c max_replication_slots=10
      -c hot_standby=on

  postgres-replica-1:
    image: ankane/pgvector:latest
    container_name: agentrecall-db-replica-1
    environment:
      - POSTGRES_USER=agentrecall
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=agentrecall
    volumes:
      - postgres_replica1_data:/var/lib/postgresql/data
    command: >
      postgres
      -c hot_standby=on
    depends_on:
      - postgres-primary

  postgres-replica-2:
    image: ankane/pgvector:latest
    container_name: agentrecall-db-replica-2
    environment:
      - POSTGRES_USER=agentrecall
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=agentrecall
    volumes:
      - postgres_replica2_data:/var/lib/postgresql/data
    command: >
      postgres
      -c hot_standby=on
    depends_on:
      - postgres-primary

  pgpool:
    image: pgpool/pgpool:latest
    container_name: agentrecall-pgpool
    environment:
      - PGPOOL_BACKEND_NODES=0:postgres-primary:5432,1:postgres-replica-1:5432,2:postgres-replica-2:5432
      - PGPOOL_SR_CHECK_USER=agentrecall
      - PGPOOL_SR_CHECK_PASSWORD=${DB_PASSWORD}
      - PGPOOL_ENABLE_LOAD_BALANCING=true
    ports:
      - "5432:5432"
    depends_on:
      - postgres-primary
      - postgres-replica-1
      - postgres-replica-2
```

#### 2.2 应用层读写分离

```typescript
// src/db/connection-manager.ts
import { Pool } from 'pg';

class ConnectionManager {
  private writePool: Pool;
  private readPool: Pool;

  constructor() {
    // 写连接池（主库）
    this.writePool = new Pool({
      host: process.env.DB_PRIMARY_HOST,
      port: 5432,
      database: 'agentrecall',
      user: 'agentrecall',
      password: process.env.DB_PASSWORD,
      max: 20,
    });

    // 读连接池（从库）
    this.readPool = new Pool({
      host: process.env.DB_REPLICA_HOST,
      port: 5432,
      database: 'agentrecall',
      user: 'agentrecall',
      password: process.env.DB_PASSWORD,
      max: 50,
    });
  }

  getWritePool(): Pool {
    return this.writePool;
  }

  getReadPool(): Pool {
    return this.readPool;
  }
}

export const connectionManager = new ConnectionManager();
```

### 阶段 3：表分区（Table Partitioning）

**适用场景**: 数据量 > 1亿条，按时间查询为主

#### 3.1 按时间分区

```sql
-- 创建分区表
CREATE TABLE pitfalls (
    id UUID DEFAULT gen_random_uuid(),
    pattern TEXT NOT NULL,
    workaround TEXT NOT NULL,
    embedding VECTOR(1024),
    taxonomy JSONB DEFAULT '{}',
    context_fingerprint TEXT,
    error_signature TEXT,
    instance_id UUID,
    submission_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- 创建月度分区
CREATE TABLE pitfalls_2024_01 PARTITION OF pitfalls
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE pitfalls_2024_02 PARTITION OF pitfalls
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- 自动创建未来分区（使用 cron 或触发器）
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_date := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    partition_name := 'pitfalls_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF pitfalls 
                    FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;
```

#### 3.2 分区索引策略

```sql
-- 在每个分区上创建索引
CREATE INDEX idx_pitfalls_2024_01_embedding 
ON pitfalls_2024_01 USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 50);

-- 全局索引（跨分区）
CREATE INDEX idx_pitfalls_error_signature_global 
ON pitfalls(error_signature);
```

### 阶段 4：向量搜索优化

**适用场景**: 向量搜索性能下降，需要毫秒级响应

#### 4.1 专用向量数据库（推荐方案）

```yaml
# docker-compose.yml - 添加 Pinecone/Milvus
services:
  # Milvus 向量数据库
  milvus-standalone:
    image: milvusdb/milvus:v2.3.3
    container_name: agentrecall-milvus
    security_opt:
      - seccomp:unconfined
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    volumes:
      - milvus_data:/var/lib/milvus
    ports:
      - "19530:19530"
      - "9091:9091"
    depends_on:
      - etcd
      - minio

  etcd:
    image: quay.io/coreos/etcd:v3.5.5
    environment:
      - ETCD_AUTO_COMPACTION_MODE=revision
      - ETCD_AUTO_COMPACTION_RETENTION=1000
      - ETCD_QUOTA_BACKEND_BYTES=4294967296
    volumes:
      - etcd_data:/etcd

  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - minio_data:/minio_data
    command: minio server /minio_data
```

#### 4.2 混合搜索架构

```typescript
// src/search/hybrid-search.ts
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { pool } from '../db/index.js';

class HybridSearchService {
  private milvusClient: MilvusClient;

  constructor() {
    this.milvusClient = new MilvusClient({
      address: process.env.MILVUS_URL || 'localhost:19530',
    });
  }

  async searchSimilar(
    embedding: number[],
    limit: number = 10,
    filters?: Record<string, any>
  ): Promise<any[]> {
    // 1. 从 Milvus 获取向量相似结果（仅 ID 和相似度）
    const vectorResults = await this.milvusClient.search({
      collection_name: 'pitfalls',
      vector: embedding,
      limit,
      output_fields: ['pitfall_id'],
    });

    // 2. 从 PostgreSQL 获取完整数据
    const ids = vectorResults.results.map(r => r.pitfall_id);
    
    if (ids.length === 0) return [];

    const pgResult = await pool.query(
      `SELECT * FROM pitfalls WHERE id = ANY($1)`,
      [ids]
    );

    // 3. 合并结果
    return vectorResults.results.map(vr => {
      const pgData = pgResult.rows.find(r => r.id === vr.pitfall_id);
      return {
        ...pgData,
        similarity: vr.score,
      };
    });
  }

  async syncToMilvus(pitfallId: string, embedding: number[]): Promise<void> {
    await this.milvusClient.insert({
      collection_name: 'pitfalls',
      data: [{
        pitfall_id: pitfallId,
        vector: embedding,
      }],
    });
  }
}

export const hybridSearch = new HybridSearchService();
```

### 阶段 5：缓存层优化

**适用场景**: 热点数据频繁访问，减轻数据库压力

#### 5.1 多级缓存架构

```yaml
# docker-compose.yml - 添加 Redis Cluster
services:
  redis-cluster:
    image: grokzen/redis-cluster:latest
    container_name: agentrecall-redis-cluster
    environment:
      CLUSTER_ENABLED: "yes"
      CLUSTER_REQUIRE_FULL_COVERAGE: "no"
      IP: "0.0.0.0"
    ports:
      - "7000-7005:7000-7005"
```

#### 5.2 缓存策略实现

```typescript
// src/cache/multi-tier-cache.ts
import { createClient, RedisClientType } from 'redis';
import NodeCache from 'node-cache';

interface CacheConfig {
  ttl: number;
  tags?: string[];
}

class MultiTierCache {
  // L1: 本地内存缓存（毫秒级）
  private localCache: NodeCache;
  
  // L2: Redis 分布式缓存（秒级）
  private redisClient: RedisClientType;

  constructor() {
    this.localCache = new NodeCache({
      stdTTL: 60, // 1分钟
      checkperiod: 120,
      maxKeys: 10000,
    });

    this.redisClient = createClient({
      url: process.env.REDIS_URL,
    });
    this.redisClient.connect();
  }

  async get<T>(key: string): Promise<T | null> {
    // L1 查询
    const localValue = this.localCache.get<T>(key);
    if (localValue !== undefined) {
      return localValue;
    }

    // L2 查询
    const redisValue = await this.redisClient.get(key);
    if (redisValue) {
      const parsed = JSON.parse(redisValue);
      // 回填 L1
      this.localCache.set(key, parsed);
      return parsed;
    }

    return null;
  }

  async set<T>(key: string, value: T, config: CacheConfig): Promise<void> {
    // 写入 L1
    this.localCache.set(key, value, config.ttl);

    // 写入 L2
    await this.redisClient.setEx(
      key,
      config.ttl,
      JSON.stringify(value)
    );

    // 记录标签关联
    if (config.tags) {
      for (const tag of config.tags) {
        await this.redisClient.sAdd(`tag:${tag}`, key);
      }
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    const keys = await this.redisClient.sMembers(`tag:${tag}`);
    
    for (const key of keys) {
      this.localCache.del(key);
      await this.redisClient.del(key);
    }
    
    await this.redisClient.del(`tag:${tag}`);
  }
}

export const cache = new MultiTierCache();
```

### 阶段 6：水平扩展（Horizontal Scaling）

**适用场景**: 单节点无法承载，需要分布式部署

#### 6.1 Kubernetes 部署

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentrecall-mcp
  labels:
    app: agentrecall-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agentrecall-mcp
  template:
    metadata:
      labels:
        app: agentrecall-mcp
    spec:
      containers:
      - name: mcp-server
        image: agentrecall/mcp-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: agentrecall-mcp-service
spec:
  selector:
    app: agentrecall-mcp
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agentrecall-mcp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agentrecall-mcp
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### 6.2 服务网格（Istio）

```yaml
# k8s/istio.yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: agentrecall-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "api.agentrecall.io"
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: agentrecall-vs
spec:
  hosts:
  - "api.agentrecall.io"
  gateways:
  - agentrecall-gateway
  http:
  - match:
    - uri:
        prefix: /mcp
    route:
    - destination:
        host: agentrecall-mcp-service
        port:
          number: 80
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: agentrecall-dr
spec:
  host: agentrecall-mcp-service
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
```

### 阶段 7：数据归档

**适用场景**: 历史数据很少访问，需要降低存储成本

#### 7.1 冷热数据分离

```typescript
// src/archival/data-archival.ts
import { pool } from '../db/index.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

class DataArchivalService {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async archiveOldData(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // 1. 查询待归档数据
    const result = await pool.query(
      `SELECT * FROM pitfalls 
       WHERE created_at < $1 
       AND last_seen_at < $1
       LIMIT 10000`,
      [cutoffDate]
    );

    if (result.rows.length === 0) {
      return 0;
    }

    // 2. 上传到 S3
    const archiveKey = `archives/pitfalls/${cutoffDate.toISOString().split('T')[0]}.json.gz`;
    const data = JSON.stringify(result.rows);
    const compressed = await gzip(data);

    await this.s3Client.send(new PutObjectCommand({
      Bucket: process.env.ARCHIVE_BUCKET || 'agentrecall-archives',
      Key: archiveKey,
      Body: compressed,
      ContentType: 'application/gzip',
    }));

    // 3. 从主库删除（软删除）
    const ids = result.rows.map(r => r.id);
    await pool.query(
      `UPDATE pitfalls 
       SET archived = true, 
           archive_location = $1,
           updated_at = NOW()
       WHERE id = ANY($2)`,
      [archiveKey, ids]
    );

    return result.rows.length;
  }

  async restoreFromArchive(archiveKey: string): Promise<any[]> {
    // 从 S3 下载并解压
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: process.env.ARCHIVE_BUCKET || 'agentrecall-archives',
      Key: archiveKey,
    }));

    const compressed = await response.Body?.transformToByteArray();
    const decompressed = await gunzip(compressed);
    return JSON.parse(decompressed.toString());
  }
}

export const archivalService = new DataArchivalService();
```

## 监控与告警

### 关键指标

```yaml
# prometheus-rules.yaml
groups:
- name: agentrecall-alerts
  rules:
  - alert: HighDatabaseConnections
    expr: pg_stat_activity_count > 40
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Database connections high"
      
  - alert: SlowVectorSearch
    expr: histogram_quantile(0.95, rate(vector_search_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Vector search latency high"
      
  - alert: DatabaseStorageHigh
    expr: pg_database_size_bytes / pg_database_size_bytes_max > 0.85
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Database storage > 85%"
```

## 扩展决策树

```
数据量评估
├── < 1000万条
│   └── 垂直扩展（升级硬件 + 参数优化）
├── 1000万 - 1亿条
│   ├── 读写分离
│   ├── 表分区
│   └── 缓存优化
├── 1亿 - 10亿条
│   ├── 专用向量数据库（Milvus/Pinecone）
│   ├── Redis Cluster
│   └── 数据归档
└── > 10亿条
    ├── Kubernetes 水平扩展
    ├── 全球多区域部署
    └── 数据分片（Sharding）
```

## 实施路线图

| 阶段 | 时间 | 目标 | 关键任务 |
|------|------|------|----------|
| 1 | 1-2周 | 垂直扩展 | 硬件升级、参数优化 |
| 2 | 2-4周 | 读写分离 | 主从复制、pgpool |
| 3 | 4-6周 | 表分区 | 分区策略、数据迁移 |
| 4 | 6-8周 | 向量优化 | Milvus 集成 |
| 5 | 8-10周 | 缓存优化 | Redis Cluster |
| 6 | 10-12周 | 水平扩展 | K8s 部署 |

## 成本估算

| 方案 | 月成本（预估） | 适用数据量 |
|------|----------------|------------|
| 垂直扩展 | $200-500 | < 1000万 |
| 读写分离 | $500-1000 | 1000万-1亿 |
| 表分区 | $500-1000 | 1亿-10亿 |
| Milvus | $1000-2000 | > 1亿 |
| K8s 集群 | $2000-5000 | > 10亿 |
