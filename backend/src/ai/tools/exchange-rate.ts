import { ToolDefinition } from './types';

// ═══ Exchange Rate API ═══
// open.er-api.com — 免费无限制，无需 Key
// 数据源: 欧洲央行，每日更新

const ER_API = 'https://open.er-api.com/v6';

const POPULAR_CURRENCIES: Record<string, string> = {
  USD: '美元',
  EUR: '欧元',
  CNY: '人民币',
  JPY: '日元',
  GBP: '英镑',
  HKD: '港币',
  KRW: '韩元',
  SGD: '新加坡元',
  AUD: '澳元',
  CAD: '加元',
};

export const exchangeRateTool: ToolDefinition = {
  name: 'exchange_rate',
  description: `查询实时汇率。数据来自欧洲央行，每日更新。

完全免费，无需注册。支持的货币见参数列表。

当用户问以下问题时调用:
- "美元兑人民币现在多少？"
- "1万美元等于多少人民币？"
- "最近汇率走势怎么样？"`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',

  parameters: {
    type: 'object',
    properties: {
      from: {
        type: 'string',
        description: `源货币代码。常用: USD(美元), CNY(人民币), EUR(欧元), JPY(日元), GBP(英镑), HKD(港币), KRW(韩元)`,
      },
      to: {
        type: 'string',
        description: '目标货币代码。不填则返回该货币对所有常用货币的汇率。',
      },
      amount: {
        type: 'number',
        description: '金额，默认1',
        default: 1,
      },
    },
    required: ['from'],
  },

  handler: async (args) => {
    const from = ((args.from as string) || 'USD').toUpperCase();
    const to = (args.to as string || '').toUpperCase();
    const amount = (args.amount as number) || 1;

    try {
      const res = await fetch(`${ER_API}/latest/${from}`);
      if (!res.ok) throw new Error(`汇率 API HTTP ${res.status}`);
      const data = await res.json() as any;

      if (data.result !== 'success') {
        return { error: `不支持的货币: ${from}` };
      }

      const allRates = data.rates as Record<string, number>;

      if (to && allRates[to] !== undefined) {
        const rate = allRates[to];
        const converted = amount * rate;
        return {
          from: { code: from, name: POPULAR_CURRENCIES[from] || from },
          to: { code: to, name: POPULAR_CURRENCIES[to] || to },
          rate: Math.round(rate * 10000) / 10000,
          amount,
          result: Math.round(converted * 100) / 100,
          updatedAt: data.time_last_update_utc,
        };
      }

      // 返回常用汇率列表
      const rates = Object.entries(allRates)
        .filter(([code]) => POPULAR_CURRENCIES[code])
        .map(([code, rate]) => ({
          code,
          name: POPULAR_CURRENCIES[code],
          rate: Math.round((rate as number) * 10000) / 10000,
        }));

      return {
        base: { code: from, name: POPULAR_CURRENCIES[from] || from },
        amount,
        rates,
        updatedAt: data.time_last_update_utc,
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : '获取汇率失败' };
    }
  },
};
