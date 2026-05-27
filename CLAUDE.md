# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

传统视觉AI重构推演助手 — a web app for product managers and AI architects to generate "reconstruction whitepapers" that analyze replacing traditional computer vision pipelines with VLM (Vision Language Model) + Agent architectures.

The app takes a product name and a description of an existing traditional CV solution, then generates a structured analysis covering: pain points, VLM replacement nodes, MCP data integration strategies, and Human-in-the-Loop (HITL) fallback mechanisms.

## Commands

All commands run from the project root:

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

## Architecture

```
src/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts          # POST /api/generate — whitepaper generation endpoint
│   ├── layout.tsx                 # Root layout (zh-CN, dark theme, Geist fonts)
│   └── page.tsx                   # Main page — two-panel layout orchestrator
├── components/
│   ├── input-panel.tsx             # Left sidebar (380px): product name + scheme input
│   ├── result-panel.tsx            # Right panel: whitepaper output with 4 accordion sections
│   ├── theme-provider.tsx          # next-themes wrapper
│   └── ui/                         # shadcn/ui components (Radix UI primitives)
├── hooks/                          # use-mobile, use-toast
└── lib/
    ├── utils.ts                    # cn() helper (clsx + tailwind-merge)
    ├── schemas.ts                  # Zod validation schemas + inferred types
    ├── prompt.ts                   # System prompt + user message builders
    ├── api.ts                      # DeepSeek API HTTP client
    └── markdown-export.ts          # .md export string builder
```

**Data flow:** `page.tsx` owns all state (`productName`, `schemeText`, `isGenerating`, `resultData`) and passes it down to `InputPanel` and `ResultPanel` as props. The generate action calls `POST /api/generate` which proxies to the DeepSeek API (OpenAI-compatible endpoint with JSON mode).

**Styling:** Tailwind CSS 4 with CSS variables for theming (dark mode default). Uses `tw-animate-css` for animations. The `cn()` utility in `lib/utils.ts` merges Tailwind classes.

**UI primitives:** All UI components in `components/ui/` are shadcn/ui — Radix UI primitives wrapped with Tailwind styling. Use these instead of raw HTML elements for consistency.

**API:** DeepSeek API via OpenAI-compatible endpoint (`https://api.deepseek.com/chat/completions`). Uses `response_format: { type: 'json_object' }` for guaranteed JSON output. API key configured via `DEEPSEEK_API_KEY` env var. See `.env.example` for all configurable variables.
