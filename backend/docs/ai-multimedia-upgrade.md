# AI 模块多媒体能力升级 — 完整说明文档

## 一、当前状态

```
前端 ChatInput 组件有两个 disabled 按钮：
  📎 Paperclip → "添加文件（即将上线）"
  🎤 Mic       → "语音输入（即将上线）"

后端：
  - 无文件上传中间件（无 multer 等）
  - 无图片处理能力（无 sharp 等）
  - 无 PDF 解析能力（无 pdf-parse 等）
  - 无语音转录能力

数据库：
  - Conversation 表是纯文本，无附件字段

前端发消息：
  - 纯 JSON：{ message, conversationSessionId, model, provider }
```

---

## 二、语音输入

### 2.1 实现原理

```
语音输入的本质：把声音波形 → 转成文字

处理链路：
  声波 → 麦克风采集 → 数字音频 → 语音识别引擎 → 文字文本 → 填入输入框
```

### 2.2 两种技术路线

#### 路线 A：浏览器原生语音识别（Web Speech API）

```
原理：
  浏览器内置了语音识别能力
  Chrome/Edge 底层调用 Google 语音引擎
  Safari 底层调用 Apple 语音引擎
  开发者只需要调 JavaScript API，不需要后端

流程：
  用户点击 🎤
    → 浏览器弹出麦克风权限请求
    → 用户允许
    → 浏览器开始实时录音 + 识别
    → 识别结果实时显示在输入框（中间结果，灰色）
    → 用户停止说话
    → 最终结果确认写入输入框（黑色）

优点：
  - 零成本，不需要任何后端服务
  - 实时显示，延迟 < 1 秒
  - 支持中文普通话，精度高（Chrome 下）

缺点：
  - Firefox 不支持（需要降级方案）
  - 依赖网络（音频发送到 Google/Apple 服务器处理）
  - 嘈杂环境精度下降
```

#### 路线 B：录音 + 云端转录（Whisper API）

```
原理：
  浏览器录制音频文件 → 上传到后端 → 后端调用 OpenAI Whisper API → 返回文字

流程：
  用户点击 🎤
    → 浏览器用 MediaRecorder 录音，生成音频文件（webm/mp3）
    → 用户点停止
    → 音频文件上传到后端
    → 后端调用 Whisper API（OpenAI 的语音识别服务）
    → API 返回文字
    → 文字返回前端，填入输入框

优点：
  - 所有浏览器都支持（MediaRecorder 全兼容）
  - 精度极高（Whisper 是目前最强语音识别模型之一）
  - 支持 50+ 语言

缺点：
  - 需要后端接口 + OpenAI API Key
  - 有费用：$0.006/分钟
  - 有延迟：2-5 秒（录音上传 + API 处理）
```

### 2.3 推荐方案：A 优先 + B 降级

```
判断逻辑：
  浏览器支持 Web Speech API？
    ├── 是 → 用路线 A（实时识别，零成本）
    └── 否 → 用路线 B（录音 + Whisper，有成本但全兼容）
```

### 2.4 需要修改的文件

**前端（改动）：**

```
components/features/ai/ChatInput.tsx

改动内容：
  - 启用 Mic 按钮（去掉 disabled）
  - 点击时启动语音识别
  - 录音中显示动画状态（按钮变红/脉动）
  - 识别结果实时写入 textarea
  - 再次点击停止录音
```

**前端（新增）：**

```
hooks/useSpeechRecognition.ts

功能：
  - 封装 Web Speech API（webkitSpeechRecognition）
  - 提供 start / stop / isListening 状态
  - 实时返回中间结果（interim）和最终结果（final）
  - 检测浏览器是否支持，不支持时走降级方案
  - 自动语言检测或默认中文
```

```
hooks/useVoiceRecord.ts（降级方案）

功能：
  - 封装 MediaRecorder API
  - 录制音频为 webm/mp3 格式
  - 提供 start / stop / isRecording 状态
  - 录制完成后返回音频 Blob
```

**后端（改动，仅降级方案需要）：**

```
routes/llm.routes.ts

改动内容：
  - 新增 POST /llm/transcribe 接口
  - 接收音频文件 → 调用 Whisper API → 返回文字
```

**后端（新增，仅降级方案需要）：**

```
services/speech.service.ts

功能：
  - 调用 OpenAI Whisper API
  - 接收音频 Buffer → 返回转录文字
  - 错误处理 + 超时控制
```

### 2.5 不需要修改的部分

```
AIService          → 不改，语音只是把文字填入输入框，后续流程不变
数据库 Schema      → 不改，语音转成文字后就是普通文本消息
工具系统           → 不改
系统提示词          → 不改
```

### 2.6 数据流对比

```
路线 A（Web Speech API，主流浏览器）：
  用户点 🎤 → 浏览器录音 → 浏览器内置引擎识别 → 文字实时显示在输入框
  全程前端完成，不经过后端

路线 B（Whisper API，降级方案）：
  用户点 🎤 → 浏览器录音 → 录音文件上传后端 → 后端调 Whisper API → 文字返回前端 → 填入输入框
  经过后端，但只在 Firefox 等不支持 Web Speech API 的浏览器触发
```

---

## 三、图片上传 + 视觉识别

### 3.1 实现原理

```
图片识别的本质：把图片的像素数据 → 发给多模态 AI 模型 → AI "看懂" 图片内容

关键概念：多模态模型
  传统的语言模型（如 DeepSeek Chat）只能处理文字
  多模态模型（如 GPT-4o、Claude）能同时处理文字 + 图片
  发一张图片给它，它能描述内容、识别文字、分析图表

处理链路：
  用户选择图片 → 前端压缩 → 后端接收 → base64 编码 → 发给多模态 AI → AI 回答
```

### 3.2 为什么需要压缩

```
问题：原始图片太大，直接发浪费 token

举例：
  用户拍了一张 10MB 的照片（4000×3000 像素）
  → 转成 base64 = 13.3MB 文本
  → 约 3400 个 token
  → GPT-4o 费用约 $0.02/张

  但 AI 模型内部处理图片时会缩放到 ~500px
  所以发 4000px 和发 1568px 效果几乎一样

解决：
  用 sharp 库在后端压缩
  4000×3000 PNG (10MB) → 1568×1176 WebP (200KB)
  token 消耗：3400 → ~50
  视觉精度：几乎无损
```

### 3.3 需要修改的文件

**前端（改动）：**

```
components/features/ai/ChatInput.tsx

改动内容：
  - 启用 Paperclip 按钮（去掉 disabled）
  - 点击弹出文件选择（input type="file"）
  - 选择后显示文件预览卡片（缩略图 + 文件名 + 删除按钮）
  - 发送时用 FormData 代替 JSON
  - 支持拖拽文件到输入框
```

```
components/features/ai/MessageBubble.tsx

改动内容：
  - 用户消息如果有附件，渲染附件卡片
  - 图片显示缩略图（可点击放大）
  - PDF 显示文件图标 + 文件名
```

```
hooks/useAiChat.ts

改动内容：
  - sendMessage 支持传入 File 对象
  - 有文件时用 FormData 发送（代替 JSON body）
  - 无文件时保持现有 JSON 发送方式（向后兼容）
```

**前端（新增）：**

```
components/features/ai/FilePreview.tsx

功能：
  - 文件选择后的预览卡片组件
  - 图片：显示缩略图
  - PDF：显示文件图标 + 页数
  - 右上角删除按钮
  - 文件大小显示
```

```
components/features/ai/ImageLightbox.tsx

功能：
  - 点击图片缩略图后全屏查看
  - 支持缩放、拖拽
  - 点击遮罩关闭
```

**后端（新增依赖）：**

```
multer     → 文件上传中间件（解析 multipart/form-data）
sharp      → 图片压缩/缩放/格式转换
```

**后端（新增）：**

```
services/file-process.service.ts

功能：
  - 文件类型判断（图片 / PDF）
  - 图片处理：sharp 压缩 → base64 编码
  - 大图二次压缩策略（>500KB 进一步缩小）
  - 返回标准化结果供路由层使用
```

**后端（改动）：**

```
routes/llm.routes.ts

改动内容：
  - 路由入口加 multer 中间件（接收文件）
  - 有文件时调用 processFile 预处理
  - 图片：构建多模态消息格式（content 数组）
  - 拼入 messages 发给 AIService
  - 保存消息时记录附件信息
```

```
services/ai.service.ts

改动内容：
  - mockChat 方法兼容多模态 content 格式
  - 仅改 3 行，读取 content 数组中的文字部分
  - 主逻辑（chat 方法）不改
```

**数据库（改动）：**

```
schema.prisma

改动内容：
  - Conversation 表新增 attachments 字段（String?）
  - 存 JSON：[{type, fileName, fileSize}]
```

### 3.4 不需要修改的部分

```
AIService.init()           → 不改
AIService.chat()           → 不改（已支持多模态消息类型）
AIService.registerTools()  → 不改
工具系统（所有 tools/*）    → 不改
系统提示词                  → 不改
tool-router                → 不改
对话历史加载                → 不改（历史消息仍是纯文本）
```

### 3.5 AIService 为什么不用改

```
AIService.chat() 接收的参数类型：
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]

这个 OpenAI SDK 类型的 content 字段定义：
  content: string | ContentPart[]

  其中 ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }

所以：
  纯文本消息：{ role: "user", content: "你好" }
  图片消息：  { role: "user", content: [{ type: "text", text: "分析这张图" }, { type: "image_url", ... }] }

两种格式 AIService 都能直接处理，不需要任何修改。
路由层负责构建正确的 messages，AIService 只管透传给 AI API。
```

### 3.6 图片数据流

```
前端：
  用户选择图片 → File 对象 → 预览缩略图 → 用户写文字（可选）→ 点发送
  → 构建 FormData（file + message + 其他字段）
  → POST /llm/chat/stream

后端：
  multer 解析 FormData → 保存文件到磁盘 → req.file
  → processFile(req.file)
    → 读取文件 Buffer
    → sharp 压缩（1568px + WebP 80%）
    → 超 500KB 进一步压缩
    → 转 base64
    → 返回 { imageBase64, fileType, fileName, fileSize }
  → 构建多模态 messages
    → [{ role: "user", content: [{type:"text"}, {type:"image_url"}] }]
  → AIService.chat({ messages })
    → 透传给 AI API（OpenAI / DeepSeek 等）
  → AI 流式返回分析结果
  → SSE 推送前端
  → MessageBubble 渲染

前端显示：
  用户消息气泡：附件缩略图 + 文字
  AI 回复气泡：Markdown 渲染分析结果
```

---

## 四、PDF 上传 + 文本提取

### 4.1 实现原理

```
PDF 文本提取的本质：从 PDF 二进制格式中解析出文字内容

PDF 文件内部结构：
  不是简单的文本文件，而是一种复杂的对象格式
  包含：页面对象、字体对象、文字流、图片对象、元数据等

  文字型 PDF：有文字对象层 → pdf-parse 可以直接提取文字
  扫描型 PDF：只有图片对象层 → pdf-parse 提取不出文字，需要 OCR

处理链路：
  PDF 文件 → pdf-parse 解析 → 提取文字 → 判断大小
    ├── 小文件（<3000 token）→ 直接拼入消息发给 AI
    ├── 中文件（3000-8000 token）→ 截取前 60%
    └── 大文件（>8000 token）→ 用小模型做摘要
```

### 4.2 为什么不能全量发送

```
token 消耗估算（中文约 1 字 ≈ 1 token）：

  PDF 页数    文字量        token 数      费用(DeepSeek)
  ────────────────────────────────────────────────────
  3 页       ~1500 字      ~1000         $0.0001
  10 页      ~5000 字      ~3300         $0.0005
  50 页      ~25000 字     ~16000        $0.002
  100 页     ~50000 字     ~33000        $0.005

  问题：
    - 100 页 PDF 占掉一半上下文窗口
    - AI 在海量文本里找不到重点，回答质量反而下降
    - token 费用虽然不高，但累积可观

  解决：分级处理
    小文件 → 直接发（不浪费处理时间）
    大文件 → 截取或摘要（省 token + AI 更聚焦）
```

### 4.3 摘要怎么做

```
大文件处理流程：

  50 页 PDF 文本（16000 token）
       │
       ▼
  调用便宜模型（DeepSeek Chat，$0.14/百万 token）
  提示词："用 500 字概括这份文档，保留关键数据（金额、日期、人名）"
       │
       ▼
  返回 500 token 摘要
  费用：~$0.002
       │
       ▼
  拼入 userContent 发给主 AI
  主 AI 基于摘要回答，token 消耗正常

  为什么用便宜模型做摘要：
    摘要不需要强推理能力
    DeepSeek 价格是 GPT-4o 的 1/18
    两阶段调用总费用 < 全量发送费用
```

### 4.4 扫描型 PDF 怎么处理

```
判断方法：
  pdf-parse 提取后 text.length < 50 → 大概率是扫描件

处理方式：
  把 PDF 每页转成图片 → 走图片处理流程（sharp 压缩 → base64 → 发给视觉模型）

  需要额外依赖：pdf2poppler 或 pdf-lib（PDF 转图片）

  实际建议：Phase 1 先不做扫描件支持
    - 大多数业务 PDF（报价单、合同、报表）都是文字型
    - 扫描件处理复杂度高，可以后续迭代
```

### 4.5 需要修改的文件

**后端（新增依赖）：**

```
pdf-parse  → PDF 文本提取
```

**后端（改动）：**

```
services/file-process.service.ts

改动内容（在图片处理基础上新增 PDF 处理分支）：
  - PDF 文件：pdf-parse 提取全文
  - 估算 token 数
  - 小文件：直接返回全文
  - 大文件：截取前 60% 或调小模型做摘要
  - 返回 { contentForAI, wasTruncated, summary }
```

```
routes/llm.routes.ts

改动内容（在图片处理逻辑基础上加 PDF 分支）：
  - processFile 返回 PDF 结果时
  - 构建纯文本 messages（content 是字符串拼接）
  - 不需要多模态格式
```

**前端（改动）：**

```
components/features/ai/FilePreview.tsx

改动内容：
  - PDF 文件显示文件图标 + 文件名 + 页数
  - 不显示缩略图（PDF 没有预览图）
```

### 4.6 不需要修改的部分（与图片相同）

```
AIService 核心逻辑  → 不改
工具系统            → 不改
系统提示词          → 不改
```

### 4.7 PDF 数据流

```
小 PDF（3 页，~1000 token）：
  用户上传 → multer 接收 → pdf-parse 提取 → 全文拼入 userContent
  → AIService.chat() → AI 基于全文回答

大 PDF（50 页，~16000 token）：
  用户上传 → multer 接收 → pdf-parse 提取 → 判断 token > 3000
  → 调 DeepSeek 做摘要（500 token）→ 摘要拼入 userContent
  → AIService.chat() → AI 基于摘要回答
```

---

## 五、预处理层架构

### 5.1 预处理层的定位

```
当前架构：
  前端 → llm.routes.ts → AIService → AI 模型

加入预处理层：
  前端 → llm.routes.ts → file-process.service.ts → AIService → AI 模型
                               ↑ 新增这一层
                               │
                               文件进 → 处理好的文本/图片出
                               AIService 不知道文件的存在
```

### 5.2 预处理层的职责

```
输入：Express.Multer.File（multer 解析后的文件对象）

处理：
  ┌────────────────────────────────────┐
  │         file-process.service        │
  │                                    │
  │  1. 读取文件 → Buffer（内存二进制）  │
  │  2. 判断 MIME 类型                  │
  │  3. 按类型走不同管线               │
  │     ├── 图片 → sharp 压缩 → base64  │
  │     ├── PDF  → pdf-parse → 文本     │
  │     └── 其他 → 报错                 │
  │  4. 大文件额外处理（截取/摘要）     │
  │  5. 输出标准化结果                  │
  └────────────────────────────────────┘

输出：ProcessedResult
  {
    fileType:      "image" | "pdf",
    fileName:      "报价单.png",
    fileSize:      184320,
    contentForAI:  "（PDF 提取的文本，图片为空）",
    imageBase64:   "（图片的 base64，PDF 为空）",
    summary:       "（大文件才有，摘要文本）",
    wasTruncated:  false,
    originalPages: 50    // 仅 PDF
  }
```

### 5.3 路由层如何使用预处理结果

```
llm.routes.ts 中的逻辑：

  有文件？
    ├── 否 → 和现在完全一样，纯文本消息
    └── 是 → 调用 processFile(file) → 得到 ProcessedResult
                │
                ├── 图片 → messages 用多模态格式（content 数组）
                └── PDF  → messages 用纯文本格式（content 字符串拼接）
                │
                └── AIService.chat() 接收标准 messages，零感知文件存在
```

---

## 六、整体改动清单

### 6.1 新增依赖

```
后端：
  multer          文件上传中间件      解析 multipart/form-data，保存文件到磁盘
  @types/multer   TypeScript 类型     multer 的类型定义
  sharp           图片处理            压缩、缩放、格式转换
  pdf-parse       PDF 文本提取        从 PDF 二进制中提取文字内容

前端：
  无新增依赖（Web Speech API 是浏览器原生，不需要 npm 包）
```

### 6.2 新增文件

```
后端：
  services/file-process.service.ts    文件预处理层（图片压缩 + PDF 提取 + 大文件摘要）
  services/speech.service.ts          语音转录服务（Whisper API 调用，仅降级方案）
  uploads/                            文件上传存储目录

前端：
  hooks/useSpeechRecognition.ts       语音识别 hook（Web Speech API 封装）
  hooks/useVoiceRecord.ts             录音 hook（MediaRecorder 封装，仅降级方案）
  components/features/ai/FilePreview.tsx    文件预览卡片组件
  components/features/ai/ImageLightbox.tsx  图片全屏查看组件
```

### 6.3 修改文件

```
后端：
  prisma/schema.prisma        Conversation 表加 attachments 字段（1 行）
  services/ai.service.ts      mockChat 兼容多模态 content 格式（3 行）
  routes/llm.routes.ts        路由加 multer + 文件预处理 + 消息构建（~50 行）
  routes/index.ts             注册 transcribe 路由（仅降级方案，1 行）

前端：
  components/features/ai/ChatInput.tsx      启用 📎🎤 按钮 + 文件选择 + 语音交互
  components/features/ai/MessageBubble.tsx  渲染附件（图片缩略图 / PDF 图标）
  hooks/useAiChat.ts                        sendMessage 支持 FormData
```

### 6.4 不修改的文件

```
AIService 类核心逻辑    → chat()、init()、registerTools() 全部不改
所有工具文件（tools/*） → 不改
系统提示词              → 不改
tool-router             → 不改
对话历史加载逻辑        → 不改
数据库其他表            → 不改
```

---

## 七、实现分期

```
Phase 1：语音输入（预计 1-2 天）
  ├── 前端 useSpeechRecognition hook
  ├── ChatInput 启用 Mic 按钮 + 语音交互
  ├── 实时识别结果显示在输入框
  └── Firefox 降级：录音 + Whisper API

Phase 2：图片上传 + 视觉识别（预计 2-3 天）
  ├── 后端 multer 中间件
  ├── 后端 file-process.service（sharp 压缩）
  ├── 前端 ChatInput 启用 📎 + 文件选择 + 预览
  ├── 前端 MessageBubble 渲染附件
  ├── 前端 useAiChat 改用 FormData
  ├── llm.routes.ts 接入预处理层
  └── schema.prisma 加 attachments 字段

Phase 3：PDF 解析（预计 1-2 天）
  ├── 后端 file-process.service 新增 PDF 处理
  ├── pdf-parse 提取 + 大文件截取/摘要
  ├── 前端 PDF 文件图标 + 文件名显示
  └── ai.service.ts mockChat 兼容修改
```

---

## 八、关键设计决策

```
决策 1：图片发给谁看？
  → 发给多模态 AI 模型（GPT-4o / Claude），不需要传统 OCR
  → 你的 DeepSeek Chat 不支持图片，图片消息需要自动切换到支持视觉的模型

决策 2：文件存在哪里？
  → 本地磁盘 uploads/ 目录（开发阶段）
  → 后续可迁移到对象存储（阿里云 OSS / 腾讯 COS）

决策 3：大 PDF 怎么处理？
  → 两级策略：小文件直接发，大文件用便宜模型做摘要
  → 不全量发送，避免浪费 token 和降低回答质量

决策 4：扫描型 PDF 怎么办？
  → Phase 1 不支持，只处理文字型 PDF
  → 后续迭代加 PDF 转图片 + 视觉模型识别

决策 5：语音识别用什么？
  → Web Speech API 优先（免费、实时）
  → Whisper API 降级（全兼容、有成本）

决策 6：AIService 要不要改？
  → 几乎不改。预处理在路由层完成，AIService 只管收标准 messages
  → 这是"预处理层"架构的核心价值：隔离变化
```
