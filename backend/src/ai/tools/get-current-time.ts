import { ToolDefinition } from './types';

export const getCurrentTimeTool: ToolDefinition = {
  name: 'get_current_time',
  description: '获取当前日期和时间。用户问"今天几号"、"现在几点"、"今天星期几"、"当前时间"时调用。创建任务/项目时如果用户说"今天"、"明天"、"下周"，也先调用此工具获取准确日期再计算。',
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async () => {
    const now = new Date();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const day = weekDays[now.getDay()];

    // 计算常用相对日期
    const today = `${y}-${m}-${d}`;
    const tomorrow = new Date(now.getTime() + 86400000);
    const tmr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
    const nextMonday = new Date(now);
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
    const nMon = `${nextMonday.getFullYear()}-${String(nextMonday.getMonth()+1).padStart(2,'0')}-${String(nextMonday.getDate()).padStart(2,'0')}`;

    return {
      datetime: `${y}-${m}-${d} ${hh}:${mm}:${ss}`,
      date: today,
      time: `${hh}:${mm}`,
      weekday: `星期${day}`,
      tomorrow: tmr,
      nextMonday: nMon,
      timestamp: now.getTime(),
    };
  },
};
