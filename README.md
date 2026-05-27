# 传统视觉 AI 重构推演助手

> Visual Reconstruction Deduction Engine

面向高级产品经理与 AI 架构师的传统视觉方案重构推演白皮书生成工具。输入产品名称和现有传统计算机视觉方案描述，自动生成结构化的 VLM + Agent 架构迁移分析报告。

## 功能

- **痛点深度分析** — 从长尾场景 ROI、数据集构建成本、非确定性输出风险等维度剖析传统方案瓶颈
- **VLM 替代节点设计** — 逐环节对比传统方案与 VLM + Agent 方案的差异和预期收益
- **MCP 数据接入规划** — 设计多模态数据（结构化/非结构化/实时流）接入 Agent 工作流的方案
- **人机协同兜底策略** — 针对大模型非确定性输出设计置信度阈值、降级路径和人工介入机制
- **白皮书导出** — 一键导出完整 Markdown 格式白皮书

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 + shadcn/ui (Radix UI) |
| 校验 | Zod |
| 通知 | Sonner |
| AI 服务 | DeepSeek API (`deepseek-v4-pro` / OpenAI 兼容端点) |

## 目录结构

```
project-root/
├── src/
│   ├── app/
│   │   ├── api/generate/route.ts    # POST /api/generate 白皮书生成接口
│   │   ├── layout.tsx               # 根布局
│   │   ├── globals.css              # 全局样式（深色企业主题）
│   │   └── page.tsx                 # 主页面 — 双栏布局编排
│   ├── components/
│   │   ├── input-panel.tsx          # 左侧输入面板（产品名 + 方案录入/上传）
│   │   ├── result-panel.tsx         # 右侧结果面板（4 个 Accordion + 导出）
│   │   └── ui/                      # shadcn/ui 组件库
│   ├── lib/
│   │   ├── schemas.ts               # Zod 校验 schema + TypeScript 类型
│   │   ├── prompt.ts                # 专家 System Prompt 构建
│   │   ├── api.ts                   # DeepSeek HTTP 客户端
│   │   ├── markdown-export.ts       # .md 导出拼接
│   │   └── utils.ts                 # cn() 工具函数
│   └── hooks/                       # use-mobile, use-toast
├── public/                          # 静态资源
├── package.json
├── next.config.mjs
├── tsconfig.json
├── .env.example                     # 环境变量模板
└── CLAUDE.md
```

## 快速开始

### 前提条件

- Node.js >= 18
- pnpm >= 9

### 安装与运行

```bash
# 1. 克隆项目
git clone <repo-url>
cd vlm-refactor-assistant

# 2. 安装依赖
pnpm install

# 3. 配置 API Key
cp .env.example .env.local
# 编辑 .env.local，填入 DeepSeek API Key
# DEEPSEEK_API_KEY=sk-your-actual-key

# 4. 启动开发服务器
pnpm dev
```

浏览器打开 http://localhost:3000 即可使用。

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | - | DeepSeek API 密钥 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | API 端点地址 |
| `DEEPSEEK_MODEL` | 否 | `deepseek-v4-pro` | 模型名称 |
| `DEEPSEEK_MAX_TOKENS` | 否 | `8192` | 最大输出 token 数 |
| `DEEPSEEK_TIMEOUT_MS` | 否 | `120000` | 请求超时（毫秒） |


## 使用说明

1. **输入方案** — 在左侧面板输入产品名称，通过直接输入或上传 `.md` 文件提供传统视觉方案详情
2. **生成推演** — 点击「生成推演白皮书」，等待 AI 分析（约 15-60 秒）
3. **查看结果** — 右侧面板展示 4 个折叠区域：痛点分析、VLM 替代节点、MCP 数据接入、人机协同设计
4. **导出白皮书** — 点击顶部「导出为 .md 文件」下载完整报告

## 架构说明

```
浏览器                                    Next.js 服务端                     DeepSeek API
───────                                  ─────────────                     ───────────
InputPanel ──→ page.tsx ──fetch──→ /api/generate/route.ts ──→ POST /chat/completions
                                        │                                  │
                                        ├── prompt.ts (System Prompt)      │
                                        ├── api.ts   (HTTP client)  ───────┘
                                        ├── JSON 解析 + 容错修复
                                        └── Zod 校验
                page.tsx ←──── { success, data } ←────────────────────────┘
                   │
ResultPanel ←──────┘
  ├── 4 个 Accordion 动态渲染
  └── handleExport → Blob download
```

关键设计决策：

- **JSON Mode** — 使用 DeepSeek OpenAI 兼容端点（`/chat/completions`），启用 `response_format: { type: 'json_object' }`，确保结构化输出
- **JSON 容错** — 三步解析策略：直接解析 → Markdown 代码块提取 → 首尾花括号截取，降低 AI 格式偏差导致的失败率
- **Token 截断处理** — 检测 `finish_reason === 'length'` 时自动截断输入重试一次
- **API Key 安全** — Key 仅存在服务端环境变量，浏览器无法访问

## 许可

MIT
