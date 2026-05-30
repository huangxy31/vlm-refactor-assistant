import { jsonrepair } from "jsonrepair";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { callDeepSeek, callDeepSeekStream } from "@/lib/api";
import { GenerationResponseSchema } from "@/lib/schemas";
import { MAX_INPUT_LENGTH, MAX_PRODUCT_NAME_LENGTH } from "@/lib/constants";
import type { ApiErrorCode, StreamEvent } from "@/lib/schemas";

const FIELD_REPLACEMENTS: [RegExp, string][] = [
  // Long camelCase field names first (avoid partial match on shorter variants)
  [/\boverallConfidence\b/gi, "整体置信度"],
  [/\bhallucinationRisks\b/gi, "幻觉风险"],
  [/\bkeyAssumptions\b/gi, "关键假设"],
  [/\bscoreAlignment\b/gi, "评分对齐"],
  [/\brelevanceCheck\b/gi, "相关性检查"],
  [/\bmcpIntegration\b/gi, "MCP集成"],
  [/\bhitlDesign\b/gi, "HITL设计"],
  [/\blongTailRisk\b/gi, "长尾风险"],
  [/\bpainPoints\b/gi, "痛点"],
  [/\bvlmNodes\b/gi, "VLM节点"],
  [/\bselfCheck\b/gi, "自检"],
  [/\bproductName\b/gi, "产品名称"],
  // Lowercase variants
  [/\boverallconfidence\b/gi, "整体置信度"],
  [/\bhallucinationrisks\b/gi, "幻觉风险"],
  [/\bkeyassumptions\b/gi, "关键假设"],
  [/\bscorealignment\b/gi, "评分对齐"],
  [/\brelevancecheck\b/gi, "相关性检查"],
  [/\bmcpintegration\b/gi, "MCP集成"],
  [/\bhitldesign\b/gi, "HITL设计"],
  [/\blongtailrisk\b/gi, "长尾风险"],
  [/\bpainpoint\b/gi, "痛点"],
  [/\bvlmnode\b/gi, "VLM节点"],
  [/\bselfcheck\b/gi, "自检"],
  [/\bproductname\b/gi, "产品名称"],
  // Single-word sub-fields
  [/\bassumptions\b/gi, "假设"],
  [/\breadiness\b/gi, "就绪度"],
  [/\btraditional\b/gi, "传统方案"],
  [/\bseverity\b/gi, "严重度"],
  [/\banalysis\b/gi, "分析"],
  [/\bsummary\b/gi, "摘要"],
  [/\btrigger\b/gi, "触发条件"],
  [/\bstrategy\b/gi, "兜底策略"],
  [/\bfallback\b/gi, "降级方案"],
  [/\bpurpose\b/gi, "接入目的"],
  [/\bmethod\b/gi, "接入方法"],
  [/\bsource\b/gi, "数据来源"],
  [/\bstage\b/gi, "环节"],
  [/\btitle\b/gi, "标题"],
  [/\bscore\b/gi, "评分"],
  [/\btype\b/gi, "数据类型"],
  [/\bgain\b/gi, "预期收益"],
  [/\brisk\b/gi, "风险"],
  [/\bvlm\b/gi, "VLM方案"],
];

function filterThinkingText(text: string, isComplete = false): string {
  // 1. Remove code fences (no value to users)
  let filtered = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`{1,2}[^`\n]+`{1,2}/g, "");

  // 2. Replace JSON schema field names with Chinese equivalents
  for (const [pattern, replacement] of FIELD_REPLACEMENTS) {
    filtered = filtered.replace(pattern, replacement);
  }

  // 3. Replace technical terms (compound patterns first to avoid duplication like "解析数据数据")
  filtered = filtered.replace(/json数据/gi, "解析数据");
  filtered = filtered.replace(/json/gi, "解析数据");
  filtered = filtered.replace(/markdown数据/gi, "文本数据");
  filtered = filtered.replace(/markdown/gi, "文本数据");

  filtered = filtered.trim();

  // 4. Incremental mode: truncate at last paragraph boundary to avoid
  //    displaying partially-formed paragraphs that might change later
  if (!isComplete && filtered) {
    const lastNewline = filtered.lastIndexOf("\n");
    if (lastNewline > 0) {
      return filtered.slice(0, lastNewline).trim();
    }
    return "";
  }

  return filtered;
}

const ERROR_SUGGESTIONS: Record<string, string> = {
  AUTH_ERROR:
    "请联系管理员检查 DEEPSEEK_API_KEY 环境变量是否正确配置，或重新生成 API Key",
  RATE_LIMITED:
    "建议等待 1-2 分钟后重新生成。如持续出现此问题，请联系管理员检查 API 配额",
  TIMEOUT:
    "当前 AI 服务负载较高，可尝试精简方案描述内容（建议 3000 字以内）后重试",
  TOKEN_LIMIT:
    "请精简方案描述内容后重试，当前内容超过 AI 处理长度限制",
  JSON_PARSE_ERROR:
    "AI 输出格式异常，可查看下方原始内容，或点击重新生成",
  SCHEMA_VALIDATION:
    "AI 输出结构不完整，可查看下方原始内容，或点击重新生成",
  API_ERROR:
    "AI 服务暂时不可用，请稍后重试。如持续失败请联系技术支持",
  INPUT_VALIDATION: "",
};

function extractJson(raw: string): string | null {
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    // continue
  }

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try {
      JSON.parse(inner);
      return inner;
    } catch {
      // continue
    }
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = raw.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(slice);
      return slice;
    } catch {
      // continue
    }
  }

  try {
    const repaired = jsonrepair(raw);
    JSON.parse(repaired);
    return repaired;
  } catch {
    // fail
  }

  return null;
}

async function tryExtractAndValidate(text: string) {
  const jsonText = extractJson(text);
  if (!jsonText) return { error: "JSON_PARSE_ERROR" as const };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { error: "JSON_PARSE_ERROR" as const };
  }

  const validated = GenerationResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.error(
      "[API] Schema validation failed:",
      JSON.stringify(validated.error.issues, null, 2)
    );
    return { error: "SCHEMA_VALIDATION" as const, details: validated.error.issues };
  }

  return { data: validated.data };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: "INVALID_JSON" as ApiErrorCode,
        message: "请求格式无效，请使用JSON格式",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { productName, solutionContent } = body as Record<string, unknown>;

  if (!productName || typeof productName !== "string" || !productName.trim()) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "INPUT_VALIDATION" as ApiErrorCode,
        message: "请输入产品名称",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (
    !solutionContent ||
    typeof solutionContent !== "string" ||
    !solutionContent.trim()
  ) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "INPUT_VALIDATION" as ApiErrorCode,
        message: "请提供方案详情",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (productName.trim().length > MAX_PRODUCT_NAME_LENGTH) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "INPUT_VALIDATION" as ApiErrorCode,
        message: `产品名称不能超过 ${MAX_PRODUCT_NAME_LENGTH} 个字符`,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (solutionContent.trim().length > MAX_INPUT_LENGTH) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "INPUT_VALIDATION" as ApiErrorCode,
        message: `方案详情不能超过 ${MAX_INPUT_LENGTH} 个字符`,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(
    productName.trim(),
    solutionContent.trim()
  );

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      send({
        type: "progress",
        stage: "generating",
        message: "AI 正在深度分析您的方案…",
      });

      let thinkingBuffer = "";
      let thinkingFlushed = false;
      let lastFlushTime = Date.now();
      const THINKING_FLUSH_MS = 3000;

      await callDeepSeekStream(
        systemPrompt,
        userMessage,
        {
          onThinking: (token: string) => {
            thinkingBuffer += token;
            // Periodic flush: every 3s, send filtered text snapshot
            const now = Date.now();
            if (now - lastFlushTime >= THINKING_FLUSH_MS && thinkingBuffer.length > 0) {
              const filtered = filterThinkingText(thinkingBuffer, false);
              if (filtered) {
                send({ type: "thinking_text", text: filtered });
              }
              lastFlushTime = now;
            }
          },
          onToken: (token: string) => {
            // Final flush of remaining thinking on first content token
            if (!thinkingFlushed && thinkingBuffer) {
              thinkingFlushed = true;
              const filtered = filterThinkingText(thinkingBuffer, true);
              if (filtered) {
                send({ type: "thinking_text", text: filtered });
              }
            }
            send({ type: "token", token });
          },
          onDone: async (fullText: string, finishReason: string) => {
            if (finishReason === "length") {
              send({
                type: "result",
                success: false,
                error: "TOKEN_LIMIT" as ApiErrorCode,
                message:
                  "输入内容过长导致AI响应被截断，请精简方案描述后重试",
                suggestion: ERROR_SUGGESTIONS.TOKEN_LIMIT,
                retryAttempted: 0,
              });
              controller.close();
              return;
            }

            let extracted = await tryExtractAndValidate(fullText);

            if ("error" in extracted) {
              console.warn(
                `[API] Streaming parse failed (${extracted.error}), retrying with non-streaming...`
              );
              send({
                type: "progress",
                stage: "retrying",
                attempt: 1,
                maxRetries: 1,
                message: "AI 返回格式异常，正在重新生成...",
              });

              const retryResult = await callDeepSeek(systemPrompt, userMessage);

              if (retryResult.success && retryResult.finishReason !== "length") {
                extracted = await tryExtractAndValidate(retryResult.text);
              }
            }

            if ("data" in extracted) {
              send({
                type: "result",
                success: true,
                data: extracted.data!,
              });
              controller.close();
              return;
            }

            const errorMessages: Record<string, string> = {
              JSON_PARSE_ERROR: "AI 返回格式异常，请查看下方原始输出",
              SCHEMA_VALIDATION: "AI 返回数据结构不完整，请查看下方原始输出",
            };

            send({
              type: "result",
              success: false,
              error: extracted.error,
              message: errorMessages[extracted.error] || "AI 返回格式异常，请重试",
              suggestion: ERROR_SUGGESTIONS[extracted.error] || undefined,
              rawText: fullText,
              details:
                "details" in extracted ? extracted.details : undefined,
            });
            controller.close();
          },
          onError: (error) => {
            send({
              type: "result",
              success: false,
              error: error.error,
              message: error.message,
              suggestion: ERROR_SUGGESTIONS[error.error] || undefined,
              retryAttempted: error.retryAttempted ?? 0,
            });
            controller.close();
          },
          onRetry: (attempt, maxRetries) => {
            send({
              type: "progress",
              stage: "retrying",
              attempt,
              maxRetries,
              message: `AI 服务繁忙，正在重试 (${attempt}/${maxRetries})...`,
            });
          },
        },
        request.signal
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
