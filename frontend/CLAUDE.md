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

## 并行开发规范

### 前置条件
- `routes/index.ts` 已预注册所有模块（后端）
- 所有页面骨架已创建（前端）
- `api.ts` / `useAuth.ts` / `lib/utils.ts` 已就绪
- shadcn/ui 组件库完整（19 个组件可用）

### 标准页面开发流程（3 步）

每开发一个新模块页面，严格按以下顺序：

```
1. hooks/useXxx.ts           ← React Query 封装 API 调用
2. components/features/xxx/  ← 业务组件（表单/列表/卡片）
3. app/main/xxx/page.tsx     ← 页面组装
```

### 前端 Hook 模板

```typescript
// hooks/useXxx.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'projects';

interface XxxParams {
  page?: number;
  limit?: number;
  status?: string;
}

export function useXxxList(params?: XxxParams) {
  return useQuery({
    queryKey: [QUERY_KEY, 'list', params],
    queryFn: () => api.get('/projects', params),
  });
}

export function useXxxDetail(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'detail', id],
    queryFn: () => api.get(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateXxx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post('/projects', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useUpdateXxx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.put(`/projects/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useDeleteXxx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
```

### 页面必须处理的三种状态

每个页面都必须正确实现以下三种状态：

```typescript
// ========== 加载态 ==========
if (isLoading) {
  return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );
}

// ========== 错误态 ==========
if (error) {
  const message = error instanceof ApiError ? error.message : '加载失败';
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <AlertTriangle className="h-10 w-10 text-red-300" />
      <p className="mt-4 text-sm text-red-500">{message}</p>
    </div>
  );
}

// ========== 空状态 ==========
if (!data || data.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <FolderIcon className="h-12 w-12 text-slate-200" />
      <p className="mt-4 text-sm font-medium text-slate-500">暂无数据</p>
      <p className="mt-1 text-xs text-slate-400">点击按钮创建第一条记录</p>
      <Button className="mt-4">新建</Button>
    </div>
  );
}
```

### 新页面开发检查清单
- [ ] `hooks/useXxx.ts` — React Query 封装完整
- [ ] `components/features/xxx/` — 表单/列表/卡片组件
- [ ] `app/main/xxx/page.tsx` — loading / empty / error 三态完整
- [ ] 交互状态：hover / active / focus / loading / disabled
- [ ] 删除操作有确认弹窗
- [ ] 列表为空有空状态提示
- [ ] 数据请求失败有错误提示
- [ ] 成功/失败有 toast 通知
- [ ] `npx tsc --noEmit` 零错误

### 颜色实际使用（以仪表盘为参考）
主界面交互元素使用 **indigo-600** 作为强调色：
```
按钮主色: bg-indigo-600 hover:bg-indigo-700
链接: text-indigo-600 hover:text-indigo-500
选中态: bg-indigo-50 text-indigo-600 border-l-indigo-500
图标: text-indigo-500
```
语义色用于状态标识（Badge、标签），不做大面积背景色。
