import { ToolDefinition } from './types';
import { prisma } from '../../server';
import { decrypt } from '../../services/encryption.service';
import { fetchWithTimeout } from './fetch-with-timeout';

// ═══ Product Hunt API ═══
// 官方 GraphQL API: api.producthunt.com/v2
// 需要免费申请 Developer Token: producthunt.com → Settings → API
// 免费额度: 每天 100 次请求

const PH_API = 'https://api.producthunt.com/v2/api/graphql';

async function getPHToken(userId: string): Promise<string> {
  const row = await prisma.setting.findFirst({
    where: { userId, category: 'SEARCH', key: 'producthunt_token' },
  });
  if (!row?.value) return '';
  try { return decrypt(row.value); } catch { return row.value; }
}

export const productHuntTool: ToolDefinition = {
  name: 'product_hunt',
  description: `获取 Product Hunt 热门产品。Product Hunt 是全球最大的新产品发现平台。

需要免费申请 Developer Token（producthunt.com → Settings → API → Developer Token）。

当用户问以下问题时调用:
- "最近有什么火的 SaaS 产品/工具？"
- "Product Hunt 上今天最热的是什么？"
- "最近有什么新的 AI 产品？"
- "有什么好用的效率工具？"`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'balanced',

  parameters: {
    type: 'object',
    properties: {
      since: {
        type: 'string',
        enum: ['today', 'week', 'month'],
        description: '时间范围: today=今日(默认), week=本周, month=本月',
      },
      topN: {
        type: 'number',
        description: '返回条数，默认10，最大20',
        default: 10,
      },
    },
  },

  handler: async (args, userId) => {
    const token = await getPHToken(userId);
    if (!token) {
      return {
        configured: false,
        message: '未配置 Product Hunt Token。请在 producthunt.com → Settings → API 免费申请，然后在 设置→搜索配置 中填入。',
      };
    }

    const since = (args.since as string) || 'today';
    const topN = Math.min((args.topN as number) || 10, 20);

    // Product Hunt GraphQL query
    const query = `
      query {
        posts(order: RANKING, first: ${topN}, postedAfter: "${getDateForSince(since)}") {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              commentsCount
              topics { edges { node { name } } }
              website
              createdAt
            }
          }
        }
      }
    `;

    try {
      const res = await fetchWithTimeout(PH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`Product Hunt HTTP ${res.status}: ${err.slice(0, 200)}`);
      }

      interface PHPostNode {
        name: string;
        tagline: string;
        description?: string;
        url: string;
        website?: string;
        votesCount: number;
        commentsCount: number;
        topics?: { edges?: Array<{ node?: { name: string } }> };
      }
      interface PHResponse {
        data?: { posts?: { edges?: Array<{ node?: PHPostNode }> } };
      }

      const data = await res.json() as PHResponse;
      const edges = data?.data?.posts?.edges || [];

      return {
        configured: true,
        since,
        total: edges.length,
        products: edges.map((e) => {
          const n = e.node;
          if (!n) return null;
          return {
            name: n.name,
            tagline: n.tagline,
            description: n.description?.slice(0, 200) || '',
            url: n.url,
            website: n.website,
            votes: n.votesCount,
            comments: n.commentsCount,
            topics: (n.topics?.edges || []).map((t) => t.node?.name || ''),
            // 热度: 1 vote + 3 评论 = 综合热度
            heat: n.votesCount + (n.commentsCount || 0) * 3,
          };
        }).filter(Boolean),
      };
    } catch (err: unknown) {
      return { configured: true, error: err instanceof Error ? err.message : '获取失败' };
    }
  },
};

function getDateForSince(since: string): string {
  const now = new Date();
  const offsets: Record<string, number> = { today: 1, week: 7, month: 30 };
  const d = new Date(now.getTime() - (offsets[since] || 1) * 86400000);
  return d.toISOString().slice(0, 10);
}
