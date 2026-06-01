/**
 * 构建系统 Prompt（动态注入项目/任务/用户上下文）
 */
export function buildSystemPrompt(context: Record<string, unknown>): string {
  const parts: string[] = ['你是一人公司的 AI 助手，帮助管理项目和任务。'];

  const { projects, tasks, userName } = context;

  if (userName) {
    parts.push(`\n当前用户: ${userName}`);
  }

  if (Array.isArray(projects) && projects.length > 0) {
    const list = projects.map((p: Record<string, unknown>) => `- ${p.name} (${p.status ?? '未知'})`).join('\n');
    parts.push(`\n活跃项目:\n${list}`);
  }

  if (Array.isArray(tasks) && tasks.length > 0) {
    const list = tasks.map((t: Record<string, unknown>) => `- ${t.title} [${t.status ?? '未知'}]`).join('\n');
    parts.push(`\n待处理任务:\n${list}`);
  }

  return parts.join('\n');
}
