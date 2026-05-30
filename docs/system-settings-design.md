# 系统设置模块设计

## 页面结构

左侧侧边栏「系统设置」→ `/main/settings`

```
┌─────────────────────────────────────────────────┐
│  系统设置                                        │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│  AI 配置  │  [当前选中分类的内容]                   │
│  集成管理  │                                      │
│  安全设置  │                                      │
│  数据管理  │                                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

## 分类详情

### 1. AI 配置（参考 ai-module-spec.md 第 15 节）

| 设置项 | 类型 | 说明 | 数据库字段 |
|--------|------|------|-----------|
| AI 供应商 | 下拉选择 | DeepSeek / OpenAI / Claude / Ollama | `AI.provider` |
| API Key | 密码框（可显示） | AES 加密存储 | `AI.api_key` (encrypted) |
| API 地址 | 输入框 | 根据供应商自动填充，可自定义 | `AI.base_url` |
| 默认模型 | 下拉选择 | 根据供应商动态列表 | `AI.default_model` |
| 复杂任务模型 | 下拉选择 | 推理能力强的模型 | `AI.powerful_model` |
| 测试连接 | 按钮 | 验证 API Key 是否有效 | — |
| 连接状态 | 显示 | ✅ 连接成功 / ❌ 连接失败 | — |

**供应商模型列表：**
```
DeepSeek:
  - deepseek-chat (快速)
  - deepseek-reasoner (推理)

OpenAI:
  - gpt-4o-mini (快速)
  - gpt-4o (强大)

Claude:
  - claude-sonnet-4-20250514 (均衡)

Ollama:
  - llama3 (本地)
  - qwen2 (本地)
```

### 2. 集成管理

| 设置项 | 类型 | 说明 | 数据库字段 |
|--------|------|------|-----------|
| n8n Webhook | 输入框 | n8n 自动化回调地址 | `INTEGRATION.n8n_webhook` |
| 微信绑定 | 按钮（预留） | 后续对接微信 | — |
| 钉钉绑定 | 按钮（预留） | 后续对接钉钉 | — |
| Webhook 密钥 | 密码框 | 验证 Webhook 来源 | `INTEGRATION.webhook_secret` (encrypted) |

### 3. 安全设置

| 设置项 | 类型 | 说明 | 数据库字段 |
|--------|------|------|-----------|
| 登录设备列表 | 列表 | 显示所有 Session，可踢出 | Session 表查询 |
| 登录日志 | 列表 | 最近 20 条登录记录 | — |
| API Token 管理 | 生成/列表 | 生成个人 API Token | Session 表 |
| 两步验证 | 开关（预留） | TOTP 两步验证 | — |

### 4. 数据管理

| 设置项 | 类型 | 说明 |
|--------|------|------|
| 导出项目数据 | 按钮 | 导出项目/任务为 CSV |
| 导出客户数据 | 按钮 | 导出客户信息为 CSV |
| 清除本地缓存 | 按钮 | 清除 localStorage |
| 账号注销 | 按钮（红色） | 删除账号及所有数据 |

## 数据库设计

使用已有的 `Setting` 表（通用 KV 存储）：

```prisma
model Setting {
  id        String   @id @default(cuid())
  userId    String   @default("system")  // "system" = 全局配置
  category  String                       // AI / INTEGRATION / SECURITY
  key       String
  value     String
  encrypted Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, category, key])
}
```

**存储示例：**

| userId | category | key | value | encrypted |
|--------|----------|-----|-------|-----------|
| user1 | AI | provider | deepseek | false |
| user1 | AI | api_key | U2FsdGVk... | true |
| user1 | AI | base_url | https://api.deepseek.com | false |
| user1 | AI | default_model | deepseek-chat | false |
| user1 | AI | powerful_model | deepseek-reasoner | false |
| user1 | INTEGRATION | n8n_webhook | https://n8n.example.com/webhook/xxx | false |
| user1 | INTEGRATION | webhook_secret | U2FsdGVk... | true |

## API 设计

```
GET    /api/settings/:category        — 获取某分类所有配置
PUT    /api/settings/:category/:key   — 更新单个配置
POST   /api/settings/batch            — 批量更新
POST   /api/settings/ai/test          — 测试 AI 连接
GET    /api/settings/ai/models        — 获取供应商模型列表
GET    /api/settings/sessions         — 获取登录设备列表
DELETE /api/settings/sessions/:id     — 踢出设备
```

## 与偏好设置的区分

| 维度 | 偏好设置 (/main/preferences) | 系统设置 (/main/settings) |
|------|------------------------------|--------------------------|
| 定位 | 个人使用体验 | 系统运行配置 |
| 内容 | 主题/通知/显示/祝福语 | AI/集成/安全/数据 |
| 存储 | UserPreference 表 | Setting 表 (KV) |
| 保存方式 | 自动保存 | 手动保存 |
| 权限 | 普通用户 | 管理员优先 |
