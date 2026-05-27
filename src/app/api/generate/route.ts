import { NextResponse } from "next/server";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { callDeepSeek } from "@/lib/api";
import { GenerationResponseSchema } from "@/lib/schemas";
import type { ApiErrorCode } from "@/lib/schemas";

function extractJson(raw: string): string | null {
  // Attempt 1: direct parse
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    // continue to fallback
  }

  // Attempt 2: extract from markdown code fences
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

  // Attempt 3: find first { and last }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = raw.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(slice);
      return slice;
    } catch {
      // fail
    }
  }

  return null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_JSON" as ApiErrorCode,
        message: "请求格式无效，请使用JSON格式",
      },
      { status: 400 }
    );
  }

  const { productName, solutionContent } = body as Record<string, unknown>;

  if (!productName || typeof productName !== "string" || !productName.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "INPUT_VALIDATION" as ApiErrorCode,
        message: "请输入产品名称",
      },
      { status: 400 }
    );
  }

  if (
    !solutionContent ||
    typeof solutionContent !== "string" ||
    !solutionContent.trim()
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "INPUT_VALIDATION" as ApiErrorCode,
        message: "请提供方案详情",
      },
      { status: 400 }
    );
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(
    productName.trim(),
    solutionContent.trim()
  );

  let result = await callDeepSeek(systemPrompt, userMessage);

  // Auto-retry with truncated input if token limit hit
  if (!result.success && result.error === "TOKEN_LIMIT") {
    const truncated =
      solutionContent.trim().slice(0, 3000) +
      "\n\n...[内容过长，已自动截断]...";
    result = await callDeepSeek(
      systemPrompt,
      buildUserMessage(productName.trim(), truncated)
    );
  }

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        message: result.message,
      },
      { status: result.statusCode }
    );
  }

  // Handle token limit on successful result with length finish reason
  if (result.finishReason === "length") {
    return NextResponse.json(
      {
        success: false,
        error: "TOKEN_LIMIT" as ApiErrorCode,
        message:
          "输入内容过长导致AI响应被截断，请精简方案描述后重试",
      },
      { status: 413 }
    );
  }

  // JSON extraction with fallback
  const jsonText = extractJson(result.text);
  if (!jsonText) {
    console.error(
      "[API] Failed to parse JSON. Raw response:",
      result.text.slice(0, 500)
    );
    return NextResponse.json(
      {
        success: false,
        error: "JSON_PARSE_ERROR" as ApiErrorCode,
        message: "AI 返回格式异常，请重试",
      },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "JSON_PARSE_ERROR" as ApiErrorCode,
        message: "AI 返回格式异常，请重试",
      },
      { status: 502 }
    );
  }

  // Zod validation
  const validated = GenerationResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.error(
      "[API] Schema validation failed:",
      JSON.stringify(validated.error.issues, null, 2)
    );
    return NextResponse.json(
      {
        success: false,
        error: "SCHEMA_VALIDATION" as ApiErrorCode,
        message: "AI 返回数据结构不完整，请重试",
        details: validated.error.issues,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ success: true, data: validated.data });
}
