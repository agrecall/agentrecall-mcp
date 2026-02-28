# AgentRecall MCP Server - 修复与优化记录

## TypeScript 编译错误修复

### 1. `src/api/auth.ts`

**问题**: 
- TS6196: `OTPResponse` 和 `ActivationResponse` 接口未使用
- TS2769: `jwt.sign` 的 `expiresIn` 类型错误

**修复**:
```typescript
// 导出接口供外部使用
export interface OTPResponse { ... }
export interface ActivationResponse { ... }

// 修复 JWT 过期时间类型
const expiresInSeconds = 30 * 24 * 60 * 60; // 使用秒数
return jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
```

### 2. `src/api/pitfalls.ts`

**问题**: 
- TS6133: 未使用的参数 `req` (第264行)

**修复**:
```typescript
// 使用下划线前缀表示有意忽略的参数
router.get('/stats', async (_req: Request, res: Response) => {
```

### 3. `src/db/index.ts`

**问题**: 
- TS6133: 未使用的变量 `client` (4处事件监听器)

**修复**:
```typescript
// 使用下划线前缀
pool.on('connect', (_client) => { ... });
pool.on('acquire', (_client) => { ... });
pool.on('remove', (_client) => { ... });
pool.on('error', (err, _client) => { ... });
```

### 4. `src/index.ts`

**问题**: 
- TS6133: 未使用的变量 `res` (第56行), `next` (第171行), `promise` (第288行)

**修复**:
```typescript
// 第56行
verify: (req: any, _res, buf) => { ... }

// 第171行
app.use((err: any, req: Request, res: Response, _next: NextFunction) => { ... }

// 第288行
process.on('unhandledRejection', (reason) => { ... }
```

### 5. `src/mcp/server.ts`

**问题**: 
- TS2345: `tool.inputSchema` 类型参数不能为 undefined

**修复**:
```typescript
// 导入类型
import type { z } from 'zod';

// 类型断言
const parseResult = (tool.inputSchema as z.ZodType<any>).safeParse(args || {});
```

### 6. `src/mcp/tools.ts`

**问题**: 
- `ToolDefinition` 接口的 `inputSchema` 类型不够精确

**修复**:
```typescript
interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: z.ZodObject<any> | z.ZodEffects<any, any, any>;
}
```

## 新增文件

### 扩展方案文档
- `SCALING.md` - 数据量暴增扩展方案
  - 垂直扩展配置
  - 读写分离架构
  - 表分区策略
  - 向量搜索优化（Milvus）
  - 多级缓存
  - Kubernetes 水平扩展
  - 数据归档

### Docker Compose 配置
- `docker-compose.replica.yml` - 读写分离配置
  - 1个主库 + 2个从库
  - Pgpool-II 负载均衡
  - Redis 主从

### PostgreSQL 配置
- `postgresql.replica.conf` - 主库配置（4G内存优化）
  - 复制设置
  - 并行查询
  - 自动清理优化

### Kubernetes 配置 (`k8s/`)
- `namespace.yaml` - 命名空间
- `configmap.yaml` - 配置映射
- `secret.yaml` - 密钥（需替换实际值）
- `deployment.yaml` - 应用部署
- `hpa.yaml` - 水平自动扩缩容
- `ingress.yaml` - 入口路由

### 依赖锁定
- `server/package-lock.json` - npm 依赖锁定文件

## 更新文件

### `docker-compose.yml`
- 添加扩展方案注释
- 移除未使用的 `JWT_EXPIRES_IN` 环境变量

## 扩展方案概览

### 阶段 1: 垂直扩展 (数据量 < 1000万)
- 硬件升级: 4核8G
- PostgreSQL 参数优化
- 索引优化

### 阶段 2: 读写分离 (1000万-1亿)
- 主从复制
- Pgpool-II 负载均衡
- 应用层读写分离

### 阶段 3: 表分区 (1亿-10亿)
- 按时间分区
- 分区索引策略
- 自动分区创建

### 阶段 4: 向量搜索优化 (> 1亿)
- Milvus 向量数据库
- 混合搜索架构
- 向量数据同步

### 阶段 5: 缓存优化
- 多级缓存 (L1本地 + L2 Redis)
- 缓存标签失效
- 热点数据预热

### 阶段 6: 水平扩展 (> 10亿)
- Kubernetes 部署
- HPA 自动扩缩容
- 服务网格 (Istio)

### 阶段 7: 数据归档
- 冷热数据分离
- S3 归档存储
- 归档数据恢复

## 验证清单

- [x] TypeScript 编译无错误
- [x] 所有未使用变量已处理
- [x] 类型定义已完善
- [x] package-lock.json 已生成
- [x] 扩展方案文档已创建
- [x] Kubernetes 配置已创建
- [x] 读写分离配置已创建

## 后续建议

1. **代码质量**
   - 添加 ESLint 配置
   - 添加 Prettier 格式化
   - 添加单元测试

2. **监控告警**
   - 集成 Prometheus
   - 配置 Grafana 仪表盘
   - 设置告警规则

3. **CI/CD**
   - GitHub Actions 工作流
   - 自动化测试
   - 镜像构建与推送
