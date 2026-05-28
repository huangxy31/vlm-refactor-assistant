# CLAUDE.md

传统视觉AI重构推演助手 — Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn/ui, DeepSeek API (OpenAI-compatible JSON mode).

## Commands

```bash
pnpm dev          # Next.js dev server
pnpm build        # Production build
pnpm start        # Production server
pnpm lint         # ESLint
```

## Feature → File index

### 主页面 / 两栏布局 / 状态管理
- `src/app/page.tsx` — `Home` 组件，拥有全部 9 个 useState：`productName`, `schemeText`, `isGenerating`, `resultData`, `rawTextFallback`, `showShortInputWarning`, `retryStatus`, `isCachedResult`, `errorSuggestion`
- `src/app/layout.tsx` — 根布局，`<html lang="zh-CN" className="dark">`，加载 Geist 字体，挂载 Sonner `<Toaster />`

### 生成白皮书 / 调用 AI / 流式响应
- `src/app/page.tsx:handleGenerate()` — POST `/api/generate`，读取 NDJSON stream，处理 progress/result 事件，缓存回退
- `src/app/api/generate/route.ts:POST()` — 服务端 API 路由，调用 DeepSeek，JSON 提取/校验/重试，返回 NDJSON 流

### 输入面板 / 文件上传 / 拖拽
- `src/components/input-panel.tsx` — `InputPanel` 组件，两个 Tab（直接输入 / 上传文件），拖拽上传 `.md/.txt`，`readFile()` 自动填充产品名

### 结果展示 / 白皮书渲染 / 手风琴
- `src/components/result-panel.tsx` — `ResultPanel` 组件，4 个 Accordion 区块（痛点/VLM节点/MCP集成/HITL设计），多状态渲染（空态/加载/成功/错误/缓存提示/短输入警告）
- `src/components/result-panel.tsx:RenderMarkdown()` — 自定义 Markdown 渲染（粗体/斜体/行内代码/标题/列表）
- `src/components/result-panel.tsx:SECTION_CONFIGS` — 4 个 section 的配置（标题/图标/主题色/数据字段）

### 导出 Markdown
- `src/lib/markdown-export.ts:generateMarkdownExport()` — 将 GenerationResponse 生成完整 .md 白皮书，触发浏览器下载
- `src/components/result-panel.tsx` → 工具栏 "导出为 .md 文件" 按钮 → `generateMarkdownExport()` + Blob download

### AI Prompt / 系统提示词 / 自检逻辑
- `src/lib/prompt.ts:buildSystemPrompt()` — 完整系统提示词（角色定义、三维分析框架、JSON schema 模板、评分标准、few-shot 示例、SelfCheck 规则）
- `src/lib/prompt.ts:buildUserMessage()` — 构造用户消息
- `src/lib/prompt.ts:buildRetryUserMessage()` — 低置信度重试时的增强提示词

### DeepSeek API 调用 / 重试 / 超时
- `src/lib/api.ts:callDeepSeek()` — 主函数，最多 3 次重试，指数退避，超时减半
- `src/lib/api.ts:attemptCall()` — 单次 HTTP 调用，AbortController 超时，响应解析
- `src/lib/api.ts:isRetryableError()` — 判断是否可重试（429/超时/5xx）
- 环境变量：`DEEPSEEK_API_KEY`(必填), `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `DEEPSEEK_MAX_TOKENS`, `DEEPSEEK_TIMEOUT_MS` → `.env.example`

### JSON 解析修复 / 提取策略
- `src/app/api/generate/route.ts:extractJson()` — 4 级回退：直接解析 → markdown 代码块提取 → 花括号截取 → jsonrepair 修复
- `src/app/api/generate/route.ts:tryExtractAndValidate()` — 提取 + Zod 校验，返回 data 或 error

### 数据校验 / Schema / 类型定义
- `src/lib/schemas.ts` — 全部 Zod schema 和推断类型：`GenerationResponse`, `PainPoint`, `VlmNode`, `McpIntegration`, `HitlDesign`, `SelfCheck`, `StreamEvent`, `ApiErrorCode`

### 本地缓存 / localStorage
- `src/lib/cache.ts:getCachedResult()` — 按 hash 查找，检查 24h TTL，LRU 晋升
- `src/lib/cache.ts:setCachedResult()` — 存储 + 超过 10 条时淘汰最旧，QuotaExceededError 处理

### 错误处理链（三级递进）
1. **输入校验** → `route.ts:POST()` 开头，400 + `INPUT_VALIDATION`
2. **API 重试** → `api.ts:callDeepSeek()` 指数退避 3 次
3. **Token 超限自动截断** → `route.ts:POST()` 检测 TOKEN_LIMIT → 截断到 3000 字符重试
4. **JSON 解析失败重试** → `route.ts:POST()` 调用 extractJson 失败 → 重试 API 一次
5. **SelfCheck 低置信度重试** → `route.ts:POST()` 检测 `overallConfidence === "low"` → 用 buildRetryUserMessage 重试
6. **客户端缓存降级** → `page.tsx:handleGenerate()` catch 块 → `getCachedResult()` 兜底 + toast 警告

### 短输入警告 / 前端预检
- `src/app/page.tsx` → `SHORT_INPUT_THRESHOLD = 100` 字符，`showShortInputWarning` 状态
- `src/components/result-panel.tsx:ShortInputWarning` — 警告卡片，"继续编辑" / "仍然生成" 两个按钮

### 主题 / 样式 / CSS 变量
- `src/app/globals.css` — Tailwind CSS 4 `@import 'tailwindcss'`，CSS 变量（`--background`, `--foreground`, `--glow-blue`, `--panel-surface` 等），暗色主题
- `src/lib/utils.ts:cn()` — clsx + tailwind-merge 合并类名
- `src/components/theme-provider.tsx` — **未使用**，layout.tsx 直接硬编码 `className="dark"`

### shadcn/ui 组件（实际使用的）
- `src/components/ui/accordion.tsx` — 结果面板手风琴
- `src/components/ui/badge.tsx` — 置信度/严重度/就绪度徽标
- `src/components/ui/button.tsx` — 生成按钮、导出按钮、警告按钮
- `src/components/ui/card.tsx` — 结果面板卡片容器
- `src/components/ui/input.tsx` — 产品名输入框
- `src/components/ui/textarea.tsx` — 方案描述输入框
- `src/components/ui/tabs.tsx` — 输入面板 Tab 切换
- `src/components/ui/label.tsx` — 表单标签
- `src/components/ui/sonner.tsx` — Toast 通知容器
- 其余 `src/components/ui/*.tsx` — shadcn/ui 样板代码，当前未使用

### Toast 通知
- `src/hooks/use-toast.ts:useToast()` — toast 状态管理（reducer + pub/sub）
- `src/components/ui/toaster.tsx:Toaster` — 渲染 toast 列表

### 移动端检测
- `src/hooks/use-mobile.ts:useIsMobile()` — matchMedia 768px 断点

### 配置文件
- `next.config.mjs` — `ignoreBuildErrors: true`, `images.unoptimized: true`
- `tsconfig.json` — strict mode, path alias `@/* → ./src/*`
- `components.json` — shadcn/ui 配置（New York style, CSS variables, lucide icons）
- `postcss.config.mjs` — `@tailwindcss/postcss` 插件
- `.env.example` — 全部环境变量模板

## Data flow

```
page.tsx (all state)
  ├─→ InputPanel (props: productName, schemeText, onXxx callbacks, onGenerate)
  └─→ ResultPanel (props: isGenerating, resultData, rawTextFallback, retryStatus, …)

User clicks generate
  → page.tsx:handleGenerate()
    → POST /api/generate  { productName, solutionContent }
      → route.ts:POST()
        → prompt.ts:buildSystemPrompt() + buildUserMessage()
        → api.ts:callDeepSeek()  →  DeepSeek API
        ← NDJSON stream  { type: "progress"|"result", … }
    → page.tsx 解析 stream → setState → ResultPanel re-render
```

## Key patterns

- **No global state** — `page.tsx` 是唯一的状态容器，通过 props 向下传递，通过 callbacks 向上通信
- **Server-only API client** — `api.ts` + `route.ts` 只在服务端运行，不暴露 API key
- **Streaming NDJSON** — API 返回 `application/x-ndjson`，每行一个 JSON 事件，支持进度推送
- **Zod validation** — 所有 AI 输出经过 `schemas.ts` 的 Zod schema 校验
- **Custom Markdown** — 不使用第三方 Markdown 库，`result-panel.tsx` 手写正则渲染器
