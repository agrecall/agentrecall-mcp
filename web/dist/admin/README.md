# AgentRecall Admin Panel - 多页面结构

## 目录结构

```
admin/
├── index.html          # 登录页
├── index.js            # 登录页逻辑
├── register.html       # 注册页
├── register.js         # 注册页逻辑
├── dashboard.html      # 仪表板
├── dashboard.js        # 仪表板逻辑
├── apikeys.html        # API Keys 管理
├── apikeys.js          # API Keys 逻辑
├── history.html        # 历史记录
├── history.js          # 历史记录逻辑
├── pitfalls.html       # Pitfalls 管理
├── pitfalls.js         # Pitfalls 逻辑
├── usage.html          # 使用统计
├── usage.js            # 使用统计逻辑
├── users.html          # 用户管理 (Admin Only)
├── users.js            # 用户管理逻辑
├── system.html         # 系统设置 (Admin Only)
├── system.js           # 系统设置逻辑
├── common.js           # 共享函数 (主题、语言、API请求、认证等)
├── i18n.js             # 国际化支持
└── style.css           # 样式文件
```

## 文件说明

### 核心文件

| 文件 | 说明 |
|------|------|
| `common.js` | 所有页面共享的函数：API请求、主题切换、语言切换、认证检查、工具函数等 |
| `i18n.js` | 国际化支持，支持英文、简体中文、繁体中文 |
| `style.css` | 全局样式，支持暗黑/亮色主题 |

### 页面文件

| 页面 | HTML | JS | 说明 |
|------|------|-----|------|
| 登录 | `index.html` | `index.js` | 用户登录，记住密码功能 |
| 注册 | `register.html` | `register.js` | 新用户注册 |
| 仪表板 | `dashboard.html` | `dashboard.js` | 概览统计、最近活动 |
| API Keys | `apikeys.html` | `apikeys.js` | 创建/删除 API Keys |
| 历史记录 | `history.html` | `history.js` | 请求历史、筛选、分页 |
| Pitfalls | `pitfalls.html` | `pitfalls.js` | Pitfalls 列表 |
| 使用统计 | `usage.html` | `usage.js` | API 调用趋势、热门端点 |
| 用户管理 | `users.html` | `users.js` | 管理员功能：用户管理 |
| 系统设置 | `system.html` | `system.js` | 管理员功能：系统统计 |

## 优势

1. **按需加载** - 每个页面只加载自己需要的 JS，减少初始加载时间
2. **维护方便** - 功能模块化，修改某个页面不会影响其他页面
3. **缓存优化** - common.js、i18n.js、style.css 可被所有页面共享缓存
4. **清晰结构** - 代码组织更清晰，便于团队协作

## 导航说明

- 侧边栏导航使用 `<a href="xxx.html">` 链接直接跳转到对应页面
- 每个页面独立加载自己的数据
- 语言切换时会重新加载当前页面数据

## 认证流程

1. 访问任意页面会先检查 `localStorage` 中的 `authToken`
2. 如果没有 token，跳转到登录页
3. 登录成功后保存 token，跳转到仪表板
4. 退出登录清除 token，跳转到登录页
