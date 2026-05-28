import { jsonrepair } from "jsonrepair";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { callDeepSeek } from "@/lib/api";
import { GenerationResponseSchema } from "@/lib/schemas";
import { MAX_INPUT_LENGTH, MAX_PRODUCT_NAME_LENGTH } from "@/lib/constants";
import type { ApiErrorCode, StreamEvent } from "@/lib/schemas";

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
        message: "正在调用 AI 服务...",
      });

      let result = await callDeepSeek(systemPrompt, userMessage, {
        onRetry: (attempt, maxRetries, reason) => {
          send({
            type: "progress",
            stage: "retrying",
            attempt,
            maxRetries,
            message: `AI 服务繁忙，正在重试 (${attempt}/${maxRetries})...`,
          });
        },
      });

      // Auto-retry with truncated input if token limit hit
      if (!result.success && result.error === "TOKEN_LIMIT") {
        send({
          type: "progress",
          stage: "generating",
          message: "内容过长，正在截断后重试...",
        });
        const truncated =
          solutionContent.trim().slice(0, 3000) +
          "\n\n...[内容过长，已自动截断]...";
        result = await callDeepSeek(
          systemPrompt,
          buildUserMessage(productName.trim(), truncated),
          {
            onRetry: (attempt, maxRetries) => {
              send({
                type: "progress",
                stage: "retrying",
                attempt,
                maxRetries,
                message: `AI 服务繁忙，正在重试 (${attempt}/${maxRetries})...`,
              });
            },
          }
        );
      }

      if (!result.success) {
        send({
          type: "result",
          success: false,
          error: result.error,
          message: result.message,
          suggestion: ERROR_SUGGESTIONS[result.error] || undefined,
          retryAttempted: result.retryAttempted ?? 0,
        });
        controller.close();
        return;
      }

      // Handle token limit on successful result with length finish reason
      if (result.finishReason === "length") {
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

      let extracted = await tryExtractAndValidate(result.text);
      let rawText = result.text;

      // If first attempt fails, retry once more
      if ("error" in extracted) {
        console.warn(
          `[API] First attempt failed (${extracted.error}), retrying once...`
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
          rawText = retryResult.text;
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

      // All attempts failed — return raw text for user inspection
      console.error(
        "[API] All parse attempts failed. Raw response:",
        rawText.slice(0, 500)
      );

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
        rawText,
        details:
          "details" in extracted ? extracted.details : undefined,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
