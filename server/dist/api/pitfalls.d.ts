/**
 * AgentRecall MCP Server - Pitfalls REST API
 *
 * REST API 端点：
 * - POST /api/v1/pitfalls - 提交避坑（需 JWT，限流 10/h）
 * - GET /api/v1/pitfalls/search - 向量相似度搜索（余弦距离）
 * - GET /api/v1/pitfalls/stats - 社区统计
 * - GET /api/v1/pitfalls/:id - 获取单个避坑详情
 * - GET /api/v1/pitfalls - 获取避坑列表
 */
declare const router: import("express-serve-static-core").Router;
export { router as pitfallsRouter };
//# sourceMappingURL=pitfalls.d.ts.map