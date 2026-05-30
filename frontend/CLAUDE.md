@AGENTS.md

# 前端开发规则

## UI 设计要求（精美优先）

### 设计风格
- 参考 Linear / Notion / Vercel Dashboard 的视觉风格
- 整体白底 + 紫色主色调（`--p: #5b5fc7`）
- 圆角统一 8px，卡片阴影用 `shadow-sm`
- 字体：系统字体栈，标题加粗 700，正文 400

### 组件规范
- **必须优先用 shadcn/ui**，已有：button, card, table, dialog, badge, select, input, label, sonner, tabs, avatar, dropdown-menu, separator, sheet, textarea
- 不够用时先查 shadcn 文档，再考虑自建
- 自建组件放 `components/ui/`，业务组件放 `components/features/`

### 页面结构
```
页面容器：max-w-7xl mx-auto p-6
卡片间距：gap-4 或 gap-6
区块间距：space-y-8
标题层级：h1 text-2xl font-bold → h2 text-lg font-semibold → h3 text-base font-medium
```

### 表格规范
- 用 shadcn Table 组件
- 表头灰色背景 `bg-muted/50`
- 行 hover 效果 `hover:bg-muted/30`
- 空状态显示图标 + 文字提示
- 分页放表格下方

### 表单规范
- 用 react-hook-form + zod 校验
- 输入框用 shadcn Input/Select
- 错误提示红色文字在输入框下方
- 提交按钮 loading 状态禁用
- 弹窗表单用 shadcn Dialog

### 侧边栏规范
- 固定左侧 260px
- 当前页高亮 + 左边紫色竖线
- 分组可折叠
- 底部显示用户头像和设置入口

### 颜色使用
```
主色（操作/强调）：#5b5fc7 紫色
成功：#22c55e 绿色（已完成/通过）
警告：#f59e0b 黄色（进行中/待处理）
危险：#ef4444 红色（删除/逾期）
信息：#3b82f6 蓝色（链接/提示）
文字：#1a1a2e 主文字 / #4a4a68 次文字 / #8888a0 辅助文字
背景：#f5f6fa 页面底 / #fff 卡片底
边框：#e5e7eb
```

### 图标
- 使用 Lucide React 图标（Next.js 内置支持）
- 图标尺寸：按钮内 16px，独立图标 20px，大图标 24px
- 图标颜色跟随文字颜色或用 muted 色

### 响应式断点
```
sm: 640px   - 手机横屏
md: 768px   - 平板
lg: 1024px  - 小桌面
xl: 1280px  - 桌面
```
- 移动端：侧边栏隐藏，顶部汉堡菜单
- 平板：侧边栏收缩为图标模式

### 动画
- 状态变化用 `transition-all duration-200`
- 页面切换用 `animate-in fade-in-0 slide-in-from-bottom-2`
- 弹窗用 shadcn 默认动画
- 不要过度动画，保持克制

### 数据展示
- 数字用大号加粗 `text-2xl font-bold`
- 百分比/金额用等宽字体 `font-mono`
- 图表用 Recharts，配色跟主题一致
- 统计卡片带图标 + 趋势箭头

## 开发技能使用指南

### UI 设计阶段（写页面前先用）
- `/ecc:frontend-design-direction` — 选定视觉方向，确定配色/字体/间距基调
- `/ecc:design-system` — 生成设计 token，统一颜色/圆角/阴影/字号变量
- `/ecc:frontend-patterns` — 查 Next.js App Router 组件最佳实践

### 写组件时
- `/ecc:liquid-glass-design` — 做卡片/弹窗/侧边栏的玻璃态效果
- `/ecc:motion-foundations` — 给交互加合理的过渡动画
- `/ecc:make-interfaces-feel-better` — 微调间距/阴影/圆角让界面更有质感

### 查文档（遇到 API 不确定时）
- 使用 context7 MCP 查询 Next.js / shadcn / Tailwind / React Query 最新文档
- 示例：查 shadcn Dialog 用法、Next.js useRouter 参数、React Query useMutation 配置

### 写完页面后
- `/ecc:accessibility` — 检查无障碍（键盘导航/对比度/aria 标签）
- `/ecc:test-coverage` — 检查测试覆盖率

### 浏览器验证
- 使用 playwright MCP 打开页面截图，检查实际渲染效果
- 测试响应式：320px / 768px / 1024px / 1440px 四个断点
