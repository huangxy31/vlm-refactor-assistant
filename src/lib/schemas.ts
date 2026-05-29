import { z } from "zod";

const SeverityEnum = z.enum(["high", "medium", "low"]);
const ReadinessEnum = z.enum(["high", "medium", "low"]);

export const PainPointSchema = z.object({
  title: z.string().min(1, "痛点标题不能为空"),
  severity: SeverityEnum,
  analysis: z.string().min(1, "痛点分析不能为空"),
  longTailRisk: z.string().min(1, "长尾风险评估不能为空"),
  assumptions: z.array(z.string()).optional(),
});

export const VlmNodeSchema = z.object({
  stage: z.string().min(1, "替代环节名称不能为空"),
  traditional: z.string().min(1, "传统方案描述不能为空"),
  vlm: z.string().min(1, "VLM方案描述不能为空"),
  gain: z.string().min(1, "预期收益不能为空"),
  readiness: ReadinessEnum,
});

export const McpIntegrationSchema = z.object({
  type: z.string().min(1, "数据类型不能为空"),
  source: z.string().min(1, "数据来源不能为空"),
  method: z.string().min(1, "接入方法不能为空"),
  purpose: z.string().min(1, "接入目的不能为空"),
});

export const HitlDesignSchema = z.object({
  trigger: z.string().min(1, "触发条件不能为空"),
  risk: z.string().min(1, "风险描述不能为空"),
  strategy: z.string().min(1, "兜底策略不能为空"),
  fallback: z.string().min(1, "降级方案不能为空"),
});

export const SelfCheckSchema = z.object({
  overallConfidence: z.enum(["high", "medium", "low"]),
  scoreAlignment: z.string().min(1),
  relevanceCheck: z.string().min(1),
  hallucinationRisks: z.array(z.string().min(1)),
  keyAssumptions: z.array(z.string().min(1)),
});

export const GenerationResponseSchema = z.object({
  productName: z.string().min(1),
  score: z.number().min(0).max(100),
  summary: z.string().min(1, "执行摘要不能为空"),
  painPoints: z.array(PainPointSchema).min(1, "至少需要1个痛点分析"),
  vlmNodes: z.array(VlmNodeSchema).min(1, "至少需要1个替代节点"),
  mcpIntegration: z.array(McpIntegrationSchema).min(1, "至少需要1个MCP接入方案"),
  hitlDesign: z.array(HitlDesignSchema).min(1, "至少需要1个HITL策略"),
  selfCheck: SelfCheckSchema,
});

export type SelfCheck = z.infer<typeof SelfCheckSchema>;
export type PainPoint = z.infer<typeof PainPointSchema>;
export type VlmNode = z.infer<typeof VlmNodeSchema>;
export type McpIntegration = z.infer<typeof McpIntegrationSchema>;
export type HitlDesign = z.infer<typeof HitlDesignSchema>;
export type GenerationResponse = z.infer<typeof GenerationResponseSchema>;

export type ApiSuccessResponse = {
  success: true;
  data: GenerationResponse;
};

export type ApiErrorCode =
  | "INPUT_VALIDATION"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "TOKEN_LIMIT"
  | "JSON_PARSE_ERROR"
  | "SCHEMA_VALIDATION"
  | "API_ERROR";

export type ApiErrorResponse = {
  success: false;
  error: ApiErrorCode;
  message: string;
  suggestion?: string;
  retryAttempted?: number;
  details?: unknown;
  rawText?: string;
};

export type StreamProgressEvent = {
  type: "progress";
  stage: "generating" | "retrying";
  attempt?: number;
  maxRetries?: number;
  message: string;
};

export type StreamThinkingEvent = {
  type: "thinking";
  token: string;
};

export type StreamTokenEvent = {
  type: "token";
  token: string;
};

export type StreamResultEvent = {
  type: "result";
} & (ApiSuccessResponse | ApiErrorResponse);

export type StreamEvent = StreamProgressEvent | StreamThinkingEvent | StreamTokenEvent | StreamResultEvent;

/** Partial generation result for progressive section reveal during streaming. */
export type PartialGenerationResponse = {
  productName?: string;
  score?: number;
  summary?: string;
  painPoints?: PainPoint[];
  vlmNodes?: VlmNode[];
  mcpIntegration?: McpIntegration[];
  hitlDesign?: HitlDesign[];
  selfCheck?: SelfCheck;
};
