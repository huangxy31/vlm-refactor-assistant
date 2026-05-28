import type { ApiErrorCode } from "./schemas";

type DeepSeekSuccess = {
  success: true;
  text: string;
  finishReason: "stop" | "length";
};

type DeepSeekError = {
  success: false;
  statusCode: number;
  error: ApiErrorCode;
  message: string;
  retryAttempted?: number;
};

type DeepSeekResult = DeepSeekSuccess | DeepSeekError;

export interface DeepSeekCallbacks {
  onRetry?: (attempt: number, maxRetries: number, reason: string) => void;
}

const BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const MAX_TOKENS = parseInt(
  process.env.DEEPSEEK_MAX_TOKENS || "8192",
  10
);
const TIMEOUT_MS = parseInt(
  process.env.DEEPSEEK_TIMEOUT_MS || "120000",
  10
);
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || key === "sk-your-deepseek-api-key-here") {
    throw new Error(
      "DEEPSEEK_API_KEY is not configured. Set it in .env.local"
    );
  }
  return key;
}

function isRetryableError(error: DeepSeekError): boolean {
  if (error.error === "RATE_LIMITED") return true;
  if (error.error === "TIMEOUT") return true;
  if (error.error === "API_ERROR" && error.statusCode >= 500) return true;
  return false;
}

async function attemptCall(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number
): Promise<DeepSeekResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const statusCode = res.status;
      const errorBody = await res.text().catch(() => "");
      let error: ApiErrorCode = "API_ERROR";
      let message: string;

      switch (statusCode) {
        case 401:
          error = "AUTH_ERROR";
          message = "API 密钥无效，请检查 DEEPSEEK_API_KEY 配置";
          break;
        case 402:
          error = "API_ERROR";
          message = "API 账户余额不足，请充值后重试";
          break;
        case 429:
          error = "RATE_LIMITED";
          message = "请求过于频繁，请稍后重试";
          break;
        default:
          if (statusCode >= 500) {
            error = "API_ERROR";
            message = `AI 服务暂时不可用（${statusCode}），请稍后重试`;
          } else {
            error = "API_ERROR";
            message = `请求参数异常（${statusCode}），请检查输入内容`;
          }
      }

      console.error(
        `[DeepSeek API] ${statusCode} error: ${errorBody.slice(0, 200)}`
      );
      return { success: false, statusCode, error, message };
    }

    const data = await res.json();

    const choice = data.choices?.[0];
    if (!choice) {
      return {
        success: false,
        statusCode: 502,
        error: "API_ERROR",
        message: "AI 服务返回了空响应，请重试",
      };
    }

    const finishReason: "stop" | "length" =
      choice.finish_reason === "length" ? "length" : "stop";
    const text: string = choice.message?.content || "";

    if (!text) {
      return {
        success: false,
        statusCode: 502,
        error: "API_ERROR",
        message: "AI 服务返回了空内容，请重试",
      };
    }

    return { success: true, text, finishReason };
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === "AbortError") {
      return {
        success: false,
        statusCode: 504,
        error: "TIMEOUT",
        message: "AI 服务响应超时，请稍后重试",
      };
    }
    console.error("[DeepSeek API] Network error:", err);
    return {
      success: false,
      statusCode: 502,
      error: "API_ERROR",
      message: "网络请求失败，请检查网络连接后重试",
    };
  }
}

export async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  callbacks?: DeepSeekCallbacks
): Promise<DeepSeekResult> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (e) {
    return {
      success: false,
      statusCode: 401,
      error: "AUTH_ERROR",
      message: (e as Error).message,
    };
  }

  let lastError: DeepSeekError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const timeout =
      attempt === 0 ? TIMEOUT_MS : Math.floor(TIMEOUT_MS / 2);
    const result = await attemptCall(
      apiKey,
      systemPrompt,
      userMessage,
      timeout
    );

    if (result.success) return result;

    lastError = result;

    if (!isRetryableError(result) || attempt === MAX_RETRIES) {
      return {
        ...result,
        retryAttempted: attempt,
        message:
          attempt > 0
            ? `${result.message}（已自动重试 ${attempt} 次）`
            : result.message,
      };
    }

    const reason =
      result.error === "RATE_LIMITED"
        ? "rate_limited"
        : result.error === "TIMEOUT"
          ? "timeout"
          : "server_error";

    callbacks?.onRetry?.(attempt + 1, MAX_RETRIES, reason);

    const delay = Math.min(
      INITIAL_RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 1000,
      10000
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return {
    success: false,
    statusCode: lastError?.statusCode ?? 502,
    error: lastError?.error ?? "API_ERROR",
    message: "AI 服务暂时不可用，所有重试均已失败（已自动重试 3 次）",
    retryAttempted: MAX_RETRIES,
  };
}
