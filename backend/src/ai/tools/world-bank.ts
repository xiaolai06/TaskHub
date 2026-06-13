import { ToolDefinition } from './types';
import { fetchWithTimeout } from './fetch-with-timeout';

// ═══ 世界银行开放数据 API ═══
// 免费、无限、无需 API Key
// 200+ 国家的 GDP/人口/贸易/教育/健康等宏观指标

const WB_API = 'https://api.worldbank.org/v2';

// 常用指标
const INDICATORS: Record<string, { name: string; unit: string }> = {
  'NY.GDP.MKTP.CD': { name: 'GDP（美元）', unit: '美元' },
  'NY.GDP.MKTP.KD.ZG': { name: 'GDP 增速', unit: '%' },
  'NY.GDP.PCAP.CD': { name: '人均 GDP', unit: '美元' },
  'SP.POP.TOTL': { name: '总人口', unit: '人' },
  'FP.CPI.TOTL.ZG': { name: '通货膨胀率', unit: '%' },
  'SL.UEM.TOTL.ZS': { name: '失业率', unit: '%' },
  'NE.EXP.GNFS.ZS': { name: '出口占 GDP 比重', unit: '%' },
  'NE.IMP.GNFS.ZS': { name: '进口占 GDP 比重', unit: '%' },
  'BX.KLT.DINV.WD.GD.ZS': { name: '外商直接投资占 GDP 比重', unit: '%' },
  'SE.ADT.LITR.ZS': { name: '成人识字率', unit: '%' },
  'SP.DYN.LE00.IN': { name: '预期寿命', unit: '岁' },
  'IT.NET.USER.ZS': { name: '互联网普及率', unit: '%' },
};

// 常用国家代码
const COUNTRIES: Record<string, string> = {
  CN: '中国', US: '美国', JP: '日本', DE: '德国', GB: '英国',
  FR: '法国', IN: '印度', BR: '巴西', KR: '韩国', AU: '澳大利亚',
  CA: '加拿大', RU: '俄罗斯', IT: '意大利', ES: '西班牙', MX: '墨西哥',
  ID: '印尼', TR: '土耳其', SA: '沙特', ZA: '南非', NG: '尼日利亚',
  EG: '埃及', VN: '越南', TH: '泰国', MY: '马来西亚', SG: '新加坡',
};

// ═══ Tool 定义 ═══

export const searchWorldBankTool: ToolDefinition = {
  name: 'search_world_bank',
  description: `查询世界银行开放数据，获取 200+ 国家的宏观经济指标。免费、无限次调用、无需 API Key。

使用时机:
- "中国的 GDP 是多少？"、"美国失业率趋势"
- "对比中国和印度的经济数据"
- "某国的人口/通胀/贸易数据"
- 需要宏观经济数据做决策参考

常用指标:
GDP、GDP增速、人均GDP、总人口、通胀率、失业率、出口比重、进口比重、
外商投资、识字率、预期寿命、互联网普及率

常用国家代码:
CN(中国) US(美国) JP(日本) DE(德国) GB(英国) FR(法国) IN(印度) BR(巴西) KR(韩国)

AI 自适应提示: 宏观经济数据专用工具。问"GDP/人口/失业率/通胀/贸易"等国家级指标时直接用本工具，比 search_tavily/search_duckduckgo 更权威准确。不适用于公司/产品/技术类查询。`,
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',

  parameters: {
    type: 'object',
    properties: {
      country: {
        type: 'string',
        description: `国家代码（ISO 3166-1 alpha-2），多个用分号分隔。默认 CN。常用: ${Object.entries(COUNTRIES).slice(0, 10).map(([k, v]) => `${k}(${v})`).join(' ')}`,
        default: 'CN',
      },
      indicator: {
        type: 'string',
        description: `指标代码。默认 NY.GDP.MKTP.CD（GDP）。常用: NY.GDP.MKTP.CD(GDP) SP.POP.TOTL(人口) NY.GDP.PCAP.CD(人均GDP) FP.CPI.TOTL.ZG(通胀) SL.UEM.TOTL.ZS(失业率)`,
        default: 'NY.GDP.MKTP.CD',
      },
      startYear: {
        type: 'number',
        description: '起始年份，默认最近 5 年',
      },
      endYear: {
        type: 'number',
        description: '结束年份，默认当前年份',
      },
    },
  },

  handler: async (args) => {
    const country = (args.country as string) || 'CN';
    const indicator = (args.indicator as string) || 'NY.GDP.MKTP.CD';
    const now = new Date().getFullYear();
    const startYear = (args.startYear as number) || now - 5;
    const endYear = (args.endYear as number) || now;

    const indicatorInfo = INDICATORS[indicator] || { name: indicator, unit: '' };

    try {
      const url = `${WB_API}/country/${country}/indicator/${indicator}?date=${startYear}:${endYear}&format=json&per_page=100`;
      const res = await fetchWithTimeout(url, {}, 15_000);

      if (!res.ok) throw new Error(`World Bank API HTTP ${res.status}`);
      const json = await res.json() as any;

      if (!json || json.length < 2 || !json[1]) {
        return { error: '未找到数据', country, indicator };
      }

      const records = json[1] as any[];
      const countryName = records[0]?.country?.value || country;

      const data = records
        .filter(r => r.value !== null)
        .map(r => ({
          year: r.date,
          value: r.value,
          country: r.country?.value || country,
        }))
        .sort((a, b) => Number(a.year) - Number(b.year));

      return {
        source: 'World Bank Open Data',
        country,
        countryName,
        indicator,
        indicatorName: indicatorInfo.name,
        unit: indicatorInfo.unit,
        timeRange: `${startYear}-${endYear}`,
        total: data.length,
        data,
        availableIndicators: Object.entries(INDICATORS).map(([k, v]) => `${k}: ${v.name}`),
        note: '数据来源: 世界银行开放数据，免费无限，无需 API Key',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '世界银行数据获取失败';
      return { error: message };
    }
  },
};
