// TODO: AIService - 统一 AI 服务层（多供应商适配）
// 支持 OpenAI / Claude / DeepSeek / Ollama
// 统一接口：chat(messages, tools) / streamChat(messages, tools)
// Mock 降级：AI 不可用时返回模拟数据

export class AIService {
  // TODO: constructor(provider, apiKey, baseUrl, model)
  // TODO: chat(messages, tools?) - 发送对话
  // TODO: streamChat(messages, tools?) - SSE 流式对话
  // TODO: parseTask(text) - 自然语言解析任务
  // TODO: generateReport(data) - 生成报表
}
