# 偏好设置模块设计

## 页面结构

左侧设置页不再是单一页面，改为**左侧分类导航 + 右侧内容区**的布局。

```
┌─────────────────────────────────────────────────────┐
│  设置                                               │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│  通用设置 │  [当前选中分类的具体内容]                    │
│  通知设置 │                                          │
│  显示设置 │                                          │
│  祝福语  │                                          │
│  AI 配置 │                                          │
│  安全设置 │                                          │
│  数据管理 │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

## 分类详情

### 1. 通用设置
| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 主题模式 | 选择 | 跟随系统 | 亮色 / 暗色 / 跟随系统 |
| 语言 | 选择 | 中文 | 中文 / English |
| 时区 | 选择 | Asia/Shanghai | 常用时区列表 |
| 日期格式 | 选择 | YYYY-MM-DD | 多种格式可选 |
| 启动页面 | 选择 | 仪表盘 | 登录后默认打开的页面 |

### 2. 通知设置
| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 任务到期提醒 | 开关+选择 | 开，提前1天 | 提前 1天/3天/1周 |
| 项目进度通知 | 开关 | 开 | 项目状态变更时通知 |
| 系统消息推送 | 开关 | 开 | 系统公告、报表等 |
| 邮件通知 | 开关 | 关 | 发送邮件摘要 |
| 免打扰时段 | 时间段 | 22:00-08:00 | 该时段不推送 |

### 3. 显示设置
| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 侧边栏默认状态 | 选择 | 展开 | 展开 / 折叠 |
| 每页显示数量 | 选择 | 20 | 10 / 20 / 50 |
| 任务默认视图 | 选择 | 列表 | 列表 / 看板 / 日历 |
| 仪表盘布局 | 选择 | 标准 | 紧凑 / 标准 / 宽松 |
| 统计卡片 | 开关 | 开 | 仪表盘是否显示统计卡片 |

### 4. 祝福语管理
| 功能 | 说明 |
|------|------|
| 查看列表 | 显示所有自定义祝福语，按时段分组 |
| 添加语录 | 输入内容 + 选择生效时段 |
| 编辑语录 | 修改内容和时段 |
| 删除语录 | 删除自定义语录 |
| 启用/禁用 | 单条语录开关 |
| 语录来源标签 | 显示 custom / ai / system |
| AI 生成 | 根据当前工作状态自动生成语录（预留） |

### 5. AI 配置
| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| AI 提供商 | 选择 | DeepSeek | DeepSeek / Claude / Ollama |
| API Key | 密码框 | - | 填写 API Key |
| API 地址 | 输入框 | 默认地址 | 自定义 API 端点 |
| 模型选择 | 选择 | 默认 | 根据提供商显示可选模型 |
| 自动回复 | 开关 | 关 | AI 自动分析任务并回复 |
| 微信绑定 | 按钮 | 未绑定 | 后续对接微信（预留） |
| 钉钉绑定 | 按钮 | 未绑定 | 后续对接钉钉（预留） |

### 6. 安全设置
| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 修改密码 | 表单 | - | 跳转到个人信息页 |
| 两步验证 | 开关 | 关 | 预留 |
| 登录设备管理 | 列表 | - | 查看/踢出已登录设备 |
| API Token | 生成/管理 | - | 生成个人 API Token |
| 登录日志 | 列表 | - | 最近登录记录 |

### 7. 数据管理
| 设置项 | 类型 | 说明 |
|--------|------|------|
| 导出数据 | 按钮 | 导出项目/任务/客户为 CSV/JSON |
| 清除缓存 | 按钮 | 清除本地缓存数据 |
| 账号注销 | 按钮（红色） | 删除账号及所有数据（危险操作） |

## 数据库设计

```prisma
model Setting {
  id              String   @id @default(cuid())
  userId          String   @unique

  // 通用
  theme           String   @default("system")     // light / dark / system
  language        String   @default("zh-CN")
  timezone        String   @default("Asia/Shanghai")
  dateFormat      String   @default("YYYY-MM-DD")
  startPage       String   @default("/main/dashboard")

  // 通知
  taskReminder    Boolean  @default(true)
  reminderDays    Int      @default(1)            // 提前几天
  projectNotify   Boolean  @default(true)
  systemNotify    Boolean  @default(true)
  emailNotify     Boolean  @default(false)
  dndStart        String?                         // 免打扰开始 HH:mm
  dndEnd          String?                         // 免打扰结束 HH:mm

  // 显示
  sidebarCollapsed Boolean @default(false)
  pageSize        Int      @default(20)
  defaultView     String   @default("list")       // list / board / calendar
  dashboardLayout String   @default("standard")   // compact / standard / relaxed
  showStats       Boolean  @default(true)

  // AI
  aiProvider      String   @default("deepseek")   // deepseek / claude / ollama
  aiApiKey        String?                          // AES 加密存储
  aiEndpoint      String?
  aiModel         String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id])
}
```

## 与个人信息页的区分

| 维度 | 个人信息 (/main/profile) | 偏好设置 (/main/settings) |
|------|--------------------------|--------------------------|
| 定位 | 你是谁 | 系统怎么工作 |
| 内容 | 姓名、头像、生日、MBTI、标签 | 主题、通知、显示、AI配置 |
| 存储 | User 表 + Profile 表 | Setting 表 |
| 保存方式 | 自动保存 | 手动保存 |
| 变更频率 | 低（基本不变） | 中（按需调整） |
