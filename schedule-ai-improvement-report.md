# TaskFlow+ 排期功能 AI 改进报告

> 生成日期：2026-06-01 | 版本：基于 xiaolai 分支

---

## 一、改进目标

将排期功能从"纯算法计算"升级为"AI 辅助决策"，让排期更人性化、更智能。

**核心理念**：贪心算法保留作为核心引擎，AI 作为智能层叠加其上。

---

## 二、新增功能清单

### 2.1 AI 排期工具（5 个）

| # | 工具名称 | 功能 | 触发场景 |
|---|---------|------|---------|
| 1 | `assess_complexity` | 评估项目/任务复杂度，输出评分和修正工时 | "这个项目复杂吗"、"评估工时" |
| 2 | `evaluate_insertion` | 评估新任务插入对现有排期的影响 | "接新项目会怎样"、"插单影响" |
| 3 | `suggest_rebalance` | 检测延期/冲突，给出调整建议 | "排期有问题吗"、"需要调整吗" |
| 4 | `get_schedule_advice` | 回答排期问题，给出优先级建议 | "能完成吗"、"先做哪个"、"什么时候有空" |
| 5 | `get_historical_accuracy` | 分析历史工时准确度，学习预估偏差 | "预估准吗"、"我一般超时多少" |

### 2.2 前端组件（2 个）

| # | 组件名称 | 功能 |
|---|---------|------|
| 1 | `ScheduleQuickActions` | 排期快捷操作面板（5 个快捷按钮） |
| 2 | `ToolConfirmDialog` | AI 写操作确认对话框 |

### 2.3 后端优化

| # | 优化项 | 说明 |
|---|--------|------|
| 1 | 周末跳过 | 排期计算自动跳过周六周日 |
| 2 | 工具注册 | 5 个新工具注册到 registry |
| 3 | 系统提示词 | 更新 schedule 和 default 提示词 |

---

## 三、文件变更清单

### 3.1 新增文件

```
backend/src/ai/tools/
  ├── complexity-assessment.ts    # 复杂度评估工具
  ├── insertion-evaluation.ts     # 插单评估工具
  ├── rebalance-suggest.ts        # 重平衡建议工具
  ├── schedule-advice.ts          # 排期建议工具
  └── historical-accuracy.ts      # 历史工时学习工具

frontend/src/components/features/ai/
  ├── ScheduleQuickActions.tsx     # 排期快捷操作组件
  └── ToolConfirmDialog.tsx       # 工具确认对话框组件

docs/
  └── schedule-ai-improvement-report.md  # 本报告
```

### 3.2 修改文件

```
backend/src/ai/tools/types.ts          # 添加 'schedule' 类型
backend/src/ai/tools/registry.ts       # 注册 5 个新工具
backend/src/services/scheduler.service.ts  # 添加周末跳过逻辑
backend/src/prompts/system-schedule.txt    # 添加新工具说明
backend/src/prompts/system-default.txt     # 添加排期工具说明
```

---

## 四、算法改进详情

### 4.1 周末跳过

**原算法**：每天连续分配，包括周末
**新算法**：自动跳过周六周日

```typescript
// 新增函数
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function skipToNextWorkday(date: Date): Date {
  const result = new Date(date);
  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}
```

### 4.2 AI 复杂度评估

**评估维度**：
- 关键词检测（部署、数据库、架构等 → 高复杂度）
- 技术栈分析（React、Node.js 等 → 中复杂度）
- 描述长度（越长可能越复杂）
- 历史数据对比（如果有）

**输出**：
```json
{
  "complexityScore": 7,
  "complexityLevel": "高",
  "factors": ["涉及部署（高复杂度）", "使用React"],
  "suggestedMultiplier": 1.3,
  "recommendation": "建议预估工时增加 20-30%"
}
```

### 4.3 插单评估

**流程**：
1. 计算原始排期
2. 加入新任务重新排期
3. 对比两次排期，计算影响

**输出**：
```json
{
  "impact": {
    "affectedTasks": [
      { "title": "前端开发", "originalEnd": "6月15日", "newEnd": "6月17日", "delayDays": 2 }
    ],
    "projectEndDateChange": { "original": "6月25日", "new": "6月27日", "delayDays": 2 }
  },
  "recommendation": "会影响 1 个任务，建议与相关方沟通"
}
```

### 4.4 历史工时学习

**分析维度**：
- 平均偏差率（实际/预估）
- 准确率（偏差<10%的比例）
- 预估倾向（偏乐观/偏保守/准确）
- 按项目分组统计

**输出**：
```json
{
  "summary": { "accuracyRate": "75%", "avgMultiplier": 1.2 },
  "pattern": { "tendency": "偏乐观（经常低估工时）" },
  "recommendation": "建议预估工时乘以 1.2x"
}
```

---

## 五、工具调用流程

```
用户："帮我接一个新项目，截止 6月15日"
  ↓
AI 调用工具链：
  1. assess_complexity → 评估项目复杂度
  2. evaluate_insertion → 分析对现有排期的影响
  3. get_schedule_advice → 生成排期建议
  ↓
AI 返回："建议先做 TaskA（紧急），新项目排在 6月8日开始"
  ↓
用户确认："好的，按这个排"
  ↓
后端执行：
  - 更新 Task 表（startDate / dueDate / priority）
  - 触发排期计算
  ↓
前端自动刷新：
  - 任务看板（React Query 缓存失效）
  - 排期视图（React Query 缓存失效）
```

---

## 六、验证结果

### 6.1 工具注册

```
工具总数: 37
排期工具: assess_complexity, evaluate_insertion, suggest_rebalance, get_schedule_advice, get_historical_accuracy
```

### 6.2 AI 对话测试

```
用户：有什么延期的任务？先做哪个？
AI：今天共有 5 个待办任务...建议优先级排序：首页设计稿 → 前端开发 → 后端API...
```

---

## 七、后续优化方向

| # | 优化项 | 优先级 | 说明 |
|---|--------|--------|------|
| 1 | 任务依赖关系 | P2 | 支持"A 完成后才能做 B"的约束 |
| 2 | 节假日支持 | P2 | 支持自定义节假日列表 |
| 3 | 多人协作 | P3 | 考虑多人同时工作的资源分配 |
| 4 | AI 学习闭环 | P3 | 自动根据历史数据修正预估工时 |

---

## 八、总结

本次改进将排期功能从"纯算法"升级为"AI 辅助决策"：

| 维度 | 改进前 | 改进后 |
|------|--------|--------|
| 决策方式 | 算法自动排期 | AI 建议 + 用户确认 |
| 工时预估 | 用户手动输入 | AI 评估复杂度 + 历史学习 |
| 冲突处理 | 检测后告知 | 检测 + 建议调整方案 |
| 插单处理 | 重新排期 | 评估影响 + 建议方案 |
| 周末处理 | 不跳过 | 自动跳过周末 |

**核心价值**：让排期从"死板算法"变成"智能助手"，更贴合一人公司的真实业务场景。
