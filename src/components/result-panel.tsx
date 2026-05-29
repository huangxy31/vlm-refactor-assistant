"use client";

import { useRef, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileDown,
  FileText,
  AlertTriangle,
  BrainCircuit,
  Database,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  OctagonAlert,
  Loader2,
} from "lucide-react";
import type { RetryStatus } from "@/app/page";
import { generateMarkdownExport } from "@/lib/markdown-export";
import type {
  GenerationResponse,
  PartialGenerationResponse,
  PainPoint,
  VlmNode,
  McpIntegration,
  HitlDesign,
} from "@/lib/schemas";

interface ResultPanelProps {
  productName: string;
  isGenerating: boolean;
  hasResult: boolean;
  data?: GenerationResponse;
  rawTextFallback?: string;
  streamingText?: string;
  thinkingText?: string;
  completedSections?: Set<string>;
  partialResult?: PartialGenerationResponse;
  showShortInputWarning?: boolean;
  retryStatus?: RetryStatus | null;
  isCachedResult?: boolean;
  errorSuggestion?: string;
  onForceGenerate?: () => void;
  onDismissWarning?: () => void;
}

type SectionConfig = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  accentColor: string;
  badgeColor: string;
  getBadgeLabel: (data: GenerationResponse) => string;
};

const SECTION_CONFIGS: SectionConfig[] = [
  {
    id: "pain-points",
    icon: AlertTriangle,
    title: "痛点分析",
    subtitle: "传统视觉方案的核心瓶颈",
    accentColor: "text-amber-400",
    badgeColor: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    getBadgeLabel: (d) => `${d.painPoints.length} 项核心痛点`,
  },
  {
    id: "vlm-nodes",
    icon: BrainCircuit,
    title: "VLM 替代节点",
    subtitle: "可由 VLM + Agent 替代的关键环节与方案对比",
    accentColor: "text-primary",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    getBadgeLabel: (d) => `${d.vlmNodes.length} 个替代节点`,
  },
  {
    id: "mcp-integration",
    icon: Database,
    title: "MCP 数据接入方案",
    subtitle: "多模态数据通过 MCP 接入 Agent 工作流",
    accentColor: "text-emerald-400",
    badgeColor: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    getBadgeLabel: (d) => `${d.mcpIntegration.length} 类数据源`,
  },
  {
    id: "hitl",
    icon: ShieldCheck,
    title: "人机协同设计",
    subtitle: "Human-in-the-loop 兜底机制与非确定性输出处理策略",
    accentColor: "text-violet-400",
    badgeColor: "bg-violet-400/10 text-violet-400 border-violet-400/20",
    getBadgeLabel: (d) => `${d.hitlDesign.length} 种触发策略`,
  },
];

export function ResultPanel({
  productName,
  isGenerating,
  hasResult,
  data,
  rawTextFallback,
  streamingText,
  thinkingText,
  completedSections,
  partialResult,
  showShortInputWarning,
  retryStatus,
  isCachedResult,
  errorSuggestion,
  onForceGenerate,
  onDismissWarning,
}: ResultPanelProps) {
  const docTitle = productName
    ? `${productName}重构推演白皮书.md`
    : "重构推演白皮书.md";

  const isStreaming = isGenerating && (streamingText || thinkingText);
  const exportDisabled = !hasResult || !data || !!isStreaming;

  const handleExport = () => {
    if (!data) return;
    const mdContent = generateMarkdownExport(data, productName);
    const blob = new Blob([mdContent], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = docTitle;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-card border border-border rounded-lg flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-mono text-foreground truncate">
            {docTitle}
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              正在生成白皮书…
            </span>
          )}
          {isGenerating && !isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-primary animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              正在连接 AI 服务…
            </span>
          )}
          {hasResult && !isGenerating && (
            <Badge className="text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-1.5 py-0 h-4">
              已完成
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={exportDisabled}
          onClick={handleExport}
          className="flex-shrink-0 h-8 text-xs border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 disabled:opacity-30 gap-1.5"
        >
          <FileDown className="w-3.5 h-3.5" />
          导出为 .md 文件
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-[400px] overflow-hidden">
        {showShortInputWarning ? (
          <ShortInputWarning onForceGenerate={onForceGenerate} onDismiss={onDismissWarning} />
        ) : !hasResult && !isGenerating && !rawTextFallback ? (
          <EmptyState />
        ) : data ? (
          <ResultContent productName={productName} data={data} isCachedResult={isCachedResult} />
        ) : isStreaming ? (
          <StreamingState
            partialResult={partialResult}
            thinkingText={thinkingText}
            completedSections={completedSections}
            retryStatus={retryStatus}
          />
        ) : isGenerating ? (
          <LoadingState retryStatus={retryStatus} />
        ) : rawTextFallback ? (
          <RawTextFallback rawText={rawTextFallback} suggestion={errorSuggestion} />
        ) : (
          <EmptyState />
        )}
      </div>
    </section>
  );
}

function ShortInputWarning({
  onForceGenerate,
  onDismiss,
}: {
  onForceGenerate?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 border border-amber-400/20 rounded-lg min-h-[400px] bg-amber-400/5">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/20">
        <AlertTriangle className="w-7 h-7 text-amber-400" />
      </div>
      <div className="text-center space-y-2 max-w-sm">
        <p className="text-sm font-semibold text-foreground">
          输入信息较少
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          当前方案描述不足 100 字，可能导致白皮书报告存在不合理的输出结果。建议补充更多细节后重试。
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
          className="h-8 text-xs border-border text-muted-foreground hover:text-foreground cursor-pointer"
        >
          继续编辑
        </Button>
        <Button
          size="sm"
          onClick={onForceGenerate}
          className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
        >
          仍然生成
        </Button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 border border-dashed border-border rounded-lg min-h-[400px]">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
        <FileText className="w-7 h-7 text-muted-foreground/50" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">
          推演结果将在此展示
        </p>
        <p className="text-xs text-muted-foreground/60">
          填写左侧表单后点击"生成推演白皮书"
        </p>
      </div>
    </div>
  );
}

function LoadingState({ retryStatus }: { retryStatus?: RetryStatus | null }) {
  const showProgress = retryStatus && retryStatus.message;
  const isRetrying = showProgress && retryStatus!.attempt > 0;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-[400px]">
      {/* Progress / status banner */}
      {(showProgress || !isRetrying) && (
        <div
          className={`flex items-center gap-3 px-4 py-4 border rounded-lg ${
            isRetrying
              ? "bg-amber-400/5 border-amber-400/20 text-amber-400 animate-pulse"
              : "bg-primary/5 border-primary/20"
          }`}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {isRetrying
                ? retryStatus!.message
                : "AI 正在深度分析您的方案…"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRetrying
                ? `${retryStatus!.attempt}/${retryStatus!.maxRetries}`
                : `复杂推演预计需要 20-30 秒 · 已等待 ${elapsed}s`}
            </p>
          </div>
        </div>
      )}
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-lg bg-muted/30 animate-pulse border border-border"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

function StreamingState({
  partialResult,
  thinkingText,
  completedSections,
  retryStatus,
}: {
  partialResult?: PartialGenerationResponse;
  thinkingText?: string;
  completedSections?: Set<string>;
  retryStatus?: RetryStatus | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        userScrolledUpRef.current = !entry.isIntersecting;
        setUserScrolledUp(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!userScrolledUpRef.current && sentinelRef.current) {
      sentinelRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  });

  const jumpToLatest = () => {
    userScrolledUpRef.current = false;
    setUserScrolledUp(false);
    sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const sectionKeys = [
    "painPoints",
    "vlmNodes",
    "mcpIntegration",
    "hitlDesign",
  ] as const;

  const hasContent = !!(
    partialResult?.summary ||
    sectionKeys.some(
      (k) => (partialResult?.[k] as unknown[] | undefined)?.length
    )
  );
  const [userExpandedThinking, setUserExpandedThinking] = useState(false);
  const thinkingExpanded = thinkingText && (!hasContent || userExpandedThinking);

  // Thinking display: buffer → filter → delay 5s → typewriter
  const thinkingStartRef = useRef(0);
  const [revealedLen, setRevealedLen] = useState(0);
  const thinkingContentRef = useRef<HTMLDivElement>(null);
  const thinkingSentinelRef = useRef<HTMLDivElement>(null);
  const thinkingUserScrolledUpRef = useRef(false);

  // Track when thinking starts
  useEffect(() => {
    if (thinkingText && thinkingStartRef.current === 0) {
      thinkingStartRef.current = Date.now();
    }
    if (!thinkingText) {
      thinkingStartRef.current = 0;
      setRevealedLen(0);
    }
  }, [thinkingText]);

  // Filtered + buffered display text
  const displayThinkingText = thinkingText ? sanitizeThinkingText(thinkingText) : "";
  const bufferElapsed = thinkingStartRef.current > 0
    ? Date.now() - thinkingStartRef.current
    : 0;
  const canStartReveal = bufferElapsed > 5000 || hasContent;

  // When hasContent flips to true, freeze revealedLen (no more thinking reveal)
  const frozenRef = useRef(false);
  useEffect(() => {
    if (hasContent) frozenRef.current = true;
  }, [hasContent]);

  // IntersectionObserver for thinking content scroll anchoring
  useEffect(() => {
    const sentinel = thinkingSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        thinkingUserScrolledUpRef.current = !entry.isIntersecting;
      },
      { threshold: 0.1, root: thinkingContentRef.current }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [thinkingExpanded]);

  // Typewriter reveal — only after buffer delay
  useEffect(() => {
    if (!displayThinkingText || frozenRef.current) return;
    if (!canStartReveal) return;

    const target = displayThinkingText.length;
    if (revealedLen >= target) return;

    const id = setInterval(() => {
      setRevealedLen((prev) => {
        const next = prev + 3;
        if (next >= target) {
          clearInterval(id);
          return target;
        }
        return next;
      });
    }, 30);

    return () => clearInterval(id);
  }, [displayThinkingText, canStartReveal, revealedLen]);

  // Auto-scroll thinking content as text reveals — only if user is at bottom
  useEffect(() => {
    const sentinel = thinkingSentinelRef.current;
    if (sentinel && thinkingExpanded && !thinkingUserScrolledUpRef.current) {
      sentinel.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [revealedLen, thinkingExpanded]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0"
    >
      {/* Retry banner */}
      {retryStatus && retryStatus.attempt > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 border rounded-lg text-sm bg-amber-400/5 border-amber-400/20 text-amber-400">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span className="flex-1">{retryStatus.message}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {retryStatus.attempt}/{retryStatus.maxRetries}
          </span>
        </div>
      )}

      {/* Thinking card — shows reasoning_content until real output arrives */}
      {thinkingText && (
        <Card
          className={`border transition-colors duration-500 ${
            hasContent
              ? "bg-muted/20 border-border/50"
              : "bg-indigo-400/5 border-indigo-400/20"
          }`}
        >
          <CardContent className="p-3">
            <button
              type="button"
              onClick={() => setUserExpandedThinking(!userExpandedThinking)}
              className="flex items-center gap-2 w-full text-left"
            >
              <BrainCircuit
                className={`w-4 h-4 flex-shrink-0 ${
                  hasContent ? "text-muted-foreground/50" : "text-indigo-400"
                }`}
              />
              <span
                className={`text-xs font-medium flex-1 ${
                  hasContent ? "text-muted-foreground/60" : "text-indigo-400"
                }`}
              >
                {hasContent ? "AI 分析完成，白皮书生成中…" : "AI 正在分析您的方案…"}
              </span>
              {!hasContent && (
                <Loader2 className="w-3 h-3 animate-spin text-indigo-400/60 flex-shrink-0" />
              )}
              <ChevronRight
                className={`w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform ${
                  thinkingExpanded ? "rotate-90" : ""
                }`}
              />
            </button>
            {thinkingExpanded && (
              <div
                ref={thinkingContentRef}
                className="mt-2 text-[11px] text-muted-foreground/60 leading-relaxed font-mono max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-border/50 pt-2"
              >
                {displayThinkingText.slice(0, revealedLen)}
                <div ref={thinkingSentinelRef} className="h-px" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary — skeleton or real content */}
      {partialResult?.summary ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary font-medium uppercase tracking-widest mb-1">
                  执行摘要
                </p>
                <h2 className="text-base font-semibold text-foreground leading-snug">
                  {partialResult.productName || "产品"}重构推演评估报告
                </h2>
                <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  <RenderMarkdown content={partialResult.summary} />
                </div>
              </div>
              {partialResult.score != null && (
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">
                      替代潜力评分
                    </p>
                    <p className="text-2xl font-bold text-primary font-mono">
                      {partialResult.score}
                    </p>
                    <p className="text-[10px] text-muted-foreground">/ 100</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-3 w-20 bg-primary/20 rounded animate-pulse" />
                <div className="h-4 w-48 bg-primary/20 rounded animate-pulse" />
                <div className="space-y-1.5 mt-2">
                  <div className="h-2.5 bg-muted-foreground/10 rounded animate-pulse" />
                  <div className="h-2.5 bg-muted-foreground/10 rounded animate-pulse w-5/6" />
                  <div className="h-2.5 bg-muted-foreground/10 rounded animate-pulse w-2/3" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <div className="h-8 w-14 bg-primary/20 rounded animate-pulse" />
                <div className="h-4 w-16 bg-primary/20 rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section cards */}
      {sectionKeys.map((key, idx) => {
        const config = SECTION_CONFIGS[idx];
        const hasData =
          partialResult &&
          partialResult[key] &&
          (partialResult[key] as unknown[]).length > 0;

        return (
          <div
            key={key}
            className="bg-card border border-border rounded-lg overflow-hidden flex-shrink-0"
          >
            {hasData ? (
              <StreamingSection
                config={config}
                data={partialResult![key] as unknown[]}
                sectionKey={key}
                isComplete={completedSections?.has(key) ?? false}
              />
            ) : (
              <SectionSkeleton config={config} />
            )}
          </div>
        );
      })}

      {/* Scroll sentinel */}
      <div ref={sentinelRef} className="h-px" />

      {/* Jump to latest button */}
      {userScrolledUp && (
        <div className="sticky bottom-3 flex justify-center pointer-events-none">
          <Button
            variant="outline"
            size="sm"
            onClick={jumpToLatest}
            className="pointer-events-auto h-7 text-xs rounded-full border-border/60 bg-card/90 backdrop-blur shadow-md hover:bg-card px-3 gap-1.5"
          >
            <ChevronDown className="w-3 h-3" />
            跳至最新
          </Button>
        </div>
      )}
    </div>
  );
}

function SectionSkeleton({ config }: { config: SectionConfig }) {
  const Icon = config.icon;
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted">
          <Icon className={`w-3.5 h-3.5 ${config.accentColor} opacity-40`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              {config.title}
            </span>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />
            <span className="text-[11px] text-muted-foreground/50">
              正在生成…
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamingSection({
  config,
  data,
  sectionKey,
  isComplete,
}: {
  config: SectionConfig;
  data: unknown[];
  sectionKey: string;
  isComplete: boolean;
}) {
  const Icon = config.icon;
  const count = data.length;

  return (
    <div>
      <div className="px-4 py-3.5 flex items-center gap-3 border-b border-border">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted flex-shrink-0">
          <Icon className={`w-3.5 h-3.5 ${config.accentColor}`} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {config.title}
            </span>
            <Badge
              className={`text-[10px] border px-1.5 py-0 h-4 ${config.badgeColor}`}
            >
              {count} 项
            </Badge>
            {!isComplete && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                输出中
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {config.subtitle}
          </p>
        </div>
      </div>
      <div className="px-4 pt-2 pb-4 max-h-[40vh] overflow-y-auto">
        <StreamingSectionItems sectionKey={sectionKey} items={data} />
      </div>
    </div>
  );
}

function StreamingSectionItems({
  sectionKey,
  items,
}: {
  sectionKey: string;
  items: unknown[];
}) {
  if (sectionKey === "painPoints") {
    const pts = items as PainPoint[];
    return (
      <div className="flex flex-col gap-3">
        {pts.map((p, i) => (
          <div
            key={i}
            className="flex gap-3 p-3 bg-amber-400/5 border border-amber-400/10 rounded-md"
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-400/10 text-amber-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-foreground">{p.title}</p>
                <SeverityBadge severity={p.severity} />
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                <RenderMarkdown content={p.analysis} />
              </div>
              {p.longTailRisk && (
                <div className="mt-2 p-2 bg-amber-400/5 border border-amber-400/10 rounded">
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-0.5">
                    长尾风险评估
                  </p>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    <RenderMarkdown content={p.longTailRisk} />
                  </div>
                </div>
              )}
              {p.assumptions && p.assumptions.length > 0 && (
                <div className="mt-2 p-2 bg-amber-400/5 border border-amber-400/10 rounded">
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-0.5">
                    假设声明
                  </p>
                  <ul className="text-[11px] text-muted-foreground leading-relaxed space-y-0.5 list-none">
                    {p.assumptions.map((a, ai) => (
                      <li key={ai} className="flex items-start gap-1.5">
                        <span className="text-amber-400/50 flex-shrink-0 select-none">-</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sectionKey === "vlmNodes") {
    const nodes = items as VlmNode[];
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_80px] gap-2 px-1 mb-1">
          {["替代环节", "传统方案", "VLM+Agent 方案", "预期收益", "就绪度"].map(
            (h) => (
              <p
                key={h}
                className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
              >
                {h}
              </p>
            )
          )}
        </div>
        {nodes.map((n, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_80px] gap-2 items-start p-3 bg-primary/5 border border-primary/10 rounded-md"
          >
            <p className="text-xs font-medium text-foreground">{n.stage}</p>
            <div className="text-xs text-muted-foreground">
              <RenderMarkdown content={n.traditional} />
            </div>
            <div className="text-xs text-primary">
              <RenderMarkdown content={n.vlm} />
            </div>
            <div className="text-xs text-emerald-400">
              <RenderMarkdown content={n.gain} />
            </div>
            <ReadinessBadge readiness={n.readiness} />
          </div>
        ))}
      </div>
    );
  }

  if (sectionKey === "mcpIntegration") {
    const mcps = items as McpIntegration[];
    return (
      <div className="flex flex-col gap-3">
        {mcps.map((m, i) => (
          <div
            key={i}
            className="flex gap-3 p-3 bg-emerald-400/5 border border-emerald-400/10 rounded-md"
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground mb-0.5">
                {m.type} — {m.source}
              </p>
              <div className="text-xs text-muted-foreground leading-relaxed">
                <RenderMarkdown content={m.method} />
              </div>
              <div className="mt-2 p-2 bg-emerald-400/5 border border-emerald-400/10 rounded">
                <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-0.5">
                  接入目的
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {m.purpose}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sectionKey === "hitlDesign") {
    const hitls = items as HitlDesign[];
    return (
      <div className="flex flex-col gap-3">
        {hitls.map((h, i) => (
          <div
            key={i}
            className="flex gap-3 p-3 bg-violet-400/5 border border-violet-400/10 rounded-md"
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-full bg-violet-400/10 text-violet-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 mb-2">
                <div className="flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                    触发条件
                  </p>
                  <p className="text-xs font-mono text-violet-400 bg-violet-400/10 px-2 py-1 rounded border border-violet-400/20">
                    {h.trigger}
                  </p>
                </div>
                <div className="w-px bg-border self-stretch flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                    风险等级
                  </p>
                  <p className="text-xs font-medium text-foreground">{h.risk}</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                <RenderMarkdown content={h.strategy} />
              </div>
              <div className="mt-2 p-2 bg-violet-400/5 border border-violet-400/10 rounded">
                <p className="text-[10px] text-violet-400/70 uppercase tracking-wider mb-0.5">
                  降级方案
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {h.fallback}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function CachedResultBanner() {
  return (
    <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-lg text-xs text-amber-400">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>当前显示为缓存数据，AI 服务暂时不可用，部分结果可能不是最新的。</span>
    </div>
  );
}

function ResultContent({
  productName,
  data,
  isCachedResult,
}: {
  productName: string;
  data: GenerationResponse;
  isCachedResult?: boolean;
}) {
  const stats = [
    { label: "识别痛点", value: `${data.painPoints.length} 项` },
    { label: "替代节点", value: `${data.vlmNodes.length} 个` },
    { label: "MCP 接入源", value: `${data.mcpIntegration.length} 类` },
    { label: "HITL 策略", value: `${data.hitlDesign.length} 种` },
  ];

  return (
    <div className="flex-1 overflow-y-auto pr-1">
      {isCachedResult && <CachedResultBanner />}
      {/* Summary header */}
      <Card className="mb-4 bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          {data.selfCheck.overallConfidence === "low" && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-md text-xs text-red-400">
              <OctagonAlert className="w-3.5 h-3.5 flex-shrink-0" />
              <span>此分析可信度较低，建议结合实际情况人工复核</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-medium uppercase tracking-widest mb-1">
                执行摘要
              </p>
              <h2 className="text-base font-semibold text-foreground leading-snug">
                {data.productName || productName || "产品"}重构推演评估报告
              </h2>
              <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                <RenderMarkdown content={data.summary} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">
                  替代潜力评分
                </p>
                <p className="text-2xl font-bold text-primary font-mono">
                  {data.score}
                </p>
                <p className="text-[10px] text-muted-foreground">/ 100</p>
              </div>
              <ConfidenceBadge confidence={data.selfCheck.overallConfidence} />
            </div>
          </div>
          <div className="flex gap-3 mt-3 flex-wrap">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background/60 rounded-md border border-border"
              >
                <ChevronRight className="w-3 h-3 text-primary" />
                <span className="text-xs text-muted-foreground">
                  {s.label}
                </span>
                <span className="text-xs font-semibold text-foreground font-mono">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accordion sections */}
      <Accordion
        type="multiple"
        defaultValue={["pain-points", "vlm-nodes", "mcp-integration", "hitl"]}
        className="flex flex-col gap-2"
      >
        {/* Pain Points */}
        <AccordionItem
          value="pain-points"
          className="bg-card border border-border rounded-lg px-0 overflow-hidden"
        >
          <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/20 [&[data-state=open]]:border-b [&[data-state=open]]:border-border">
            <SectionHeader config={SECTION_CONFIGS[0]} data={data} />
          </AccordionTrigger>
          <AccordionContent className="px-4 pt-4 pb-4">
            <div className="flex flex-col gap-3">
              {data.painPoints.map((p, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-3 bg-amber-400/5 border border-amber-400/10 rounded-md"
                >
                  <div className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-400/10 text-amber-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {p.title}
                      </p>
                      <SeverityBadge severity={p.severity} />
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                      <RenderMarkdown content={p.analysis} />
                    </div>
                    <div className="mt-2 p-2 bg-amber-400/5 border border-amber-400/10 rounded">
                      <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-0.5">
                        长尾风险评估
                      </p>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">
                        <RenderMarkdown content={p.longTailRisk} />
                      </div>
                    </div>
                    {p.assumptions && p.assumptions.length > 0 && (
                      <div className="mt-2 p-2 bg-amber-400/5 border border-amber-400/10 rounded">
                        <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-0.5">
                          假设声明
                        </p>
                        <ul className="text-[11px] text-muted-foreground leading-relaxed space-y-0.5 list-none">
                          {p.assumptions.map((a, ai) => (
                            <li key={ai} className="flex items-start gap-1.5">
                              <span className="text-amber-400/50 flex-shrink-0 select-none">-</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* VLM Nodes */}
        <AccordionItem
          value="vlm-nodes"
          className="bg-card border border-border rounded-lg px-0 overflow-hidden"
        >
          <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/20 [&[data-state=open]]:border-b [&[data-state=open]]:border-border">
            <SectionHeader config={SECTION_CONFIGS[1]} data={data} />
          </AccordionTrigger>
          <AccordionContent className="px-4 pt-4 pb-4">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_80px] gap-2 px-1 mb-1">
                {["替代环节", "传统方案", "VLM+Agent 方案", "预期收益", "就绪度"].map(
                  (h) => (
                    <p
                      key={h}
                      className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      {h}
                    </p>
                  )
                )}
              </div>
              {data.vlmNodes.map((n, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_80px] gap-2 items-start p-3 bg-primary/5 border border-primary/10 rounded-md"
                >
                  <p className="text-xs font-medium text-foreground">
                    {n.stage}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    <RenderMarkdown content={n.traditional} />
                  </div>
                  <div className="text-xs text-primary">
                    <RenderMarkdown content={n.vlm} />
                  </div>
                  <div className="text-xs text-emerald-400">
                    <RenderMarkdown content={n.gain} />
                  </div>
                  <ReadinessBadge readiness={n.readiness} />
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* MCP Integration */}
        <AccordionItem
          value="mcp-integration"
          className="bg-card border border-border rounded-lg px-0 overflow-hidden"
        >
          <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/20 [&[data-state=open]]:border-b [&[data-state=open]]:border-border">
            <SectionHeader config={SECTION_CONFIGS[2]} data={data} />
          </AccordionTrigger>
          <AccordionContent className="px-4 pt-4 pb-4">
            <div className="flex flex-col gap-3">
              {data.mcpIntegration.map((m, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-3 bg-emerald-400/5 border border-emerald-400/10 rounded-md"
                >
                  <div className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground mb-0.5">
                      {m.type} — {m.source}
                    </p>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      <RenderMarkdown content={m.method} />
                    </div>
                    <div className="mt-2 p-2 bg-emerald-400/5 border border-emerald-400/10 rounded">
                      <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-0.5">
                        接入目的
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {m.purpose}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* HITL */}
        <AccordionItem
          value="hitl"
          className="bg-card border border-border rounded-lg px-0 overflow-hidden"
        >
          <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/20 [&[data-state=open]]:border-b [&[data-state=open]]:border-border">
            <SectionHeader config={SECTION_CONFIGS[3]} data={data} />
          </AccordionTrigger>
          <AccordionContent className="px-4 pt-4 pb-4">
            <div className="flex flex-col gap-3">
              {data.hitlDesign.map((h, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-3 bg-violet-400/5 border border-violet-400/10 rounded-md"
                >
                  <div className="w-5 h-5 flex items-center justify-center rounded-full bg-violet-400/10 text-violet-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="flex-shrink-0">
                        <p className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                          触发条件
                        </p>
                        <p className="text-xs font-mono text-violet-400 bg-violet-400/10 px-2 py-1 rounded border border-violet-400/20">
                          {h.trigger}
                        </p>
                      </div>
                      <div className="w-px bg-border self-stretch flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                          风险等级
                        </p>
                        <p className="text-xs font-medium text-foreground">
                          {h.risk}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      <RenderMarkdown content={h.strategy} />
                    </div>
                    <div className="mt-2 p-2 bg-violet-400/5 border border-violet-400/10 rounded">
                      <p className="text-[10px] text-violet-400/70 uppercase tracking-wider mb-0.5">
                        降级方案
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {h.fallback}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function SectionHeader({
  config,
  data,
}: {
  config: SectionConfig;
  data: GenerationResponse;
}) {
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div
        className={`flex items-center justify-center w-7 h-7 rounded-md bg-muted flex-shrink-0`}
      >
        <Icon className={`w-3.5 h-3.5 ${config.accentColor}`} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {config.title}
          </span>
          <Badge
            className={`text-[10px] border px-1.5 py-0 h-4 ${config.badgeColor}`}
          >
            {config.getBadgeLabel(data)}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {config.subtitle}
        </p>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colorMap: Record<string, string> = {
    high: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    medium: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    low: "bg-red-400/10 text-red-400 border-red-400/20",
  };
  const labelMap: Record<string, string> = {
    high: "本报告可信度：高",
    medium: "本报告可信度：中",
    low: "本报告可信度：低",
  };
  return (
    <Badge
      className={`text-[10px] px-1.5 border ${colorMap[confidence] || ""}`}
    >
      {labelMap[confidence] || `可信度：${confidence}`}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, string> = {
    high: "bg-red-400/10 text-red-400 border-red-400/20",
    medium: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    low: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  };
  const labelMap: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };
  return (
    <Badge
      className={`text-[9px] px-1.5 border ${colorMap[severity] || ""}`}
    >
      {labelMap[severity] || severity}
    </Badge>
  );
}

function ReadinessBadge({ readiness }: { readiness: string }) {
  const colorMap: Record<string, string> = {
    high: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    medium: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    low: "bg-red-400/10 text-red-400 border-red-400/20",
  };
  const labelMap: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };
  return (
    <Badge
      className={`text-[9px] px-1.5 border ${colorMap[readiness] || ""}`}
    >
      {labelMap[readiness] || readiness}
    </Badge>
  );
}

function RawTextFallback({ rawText, suggestion }: { rawText: string; suggestion?: string }) {
  return (
    <div className="flex-1 overflow-y-auto pr-1">
      <Card className="mb-4 bg-red-400/5 border-red-400/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-400/10 flex-shrink-0 mt-0.5">
              <OctagonAlert className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-400 mb-1">
                AI 返回格式异常
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                模型未能按预期 JSON 格式返回结果
              </p>
              {suggestion && (
                <p className="text-xs text-amber-400 mt-2 leading-relaxed">
                  建议：{suggestion}
                </p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-1">
                以下为原始输出内容，可复制后手动分析或重试生成。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <pre className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words font-mono max-h-[70vh] overflow-y-auto">
            {rawText}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

/** Map English schema field names → Chinese for display */
const TERM_REPLACEMENTS: [RegExp, string][] = [
  [/\bpainPoints\b/gi, "痛点分析"],
  [/\bvlmNodes\b/gi, "VLM替代节点"],
  [/\bmcpIntegration\b/gi, "MCP数据接入"],
  [/\bhitlDesign\b/gi, "人机协同设计"],
  [/\bselfCheck\b/gi, "自检"],
  [/\bproductName\b/gi, "产品名称"],
  [/\bscore\b/gi, "评分"],
  [/\bsummary\b/gi, "摘要"],
  [/\bseverity\b/gi, "严重程度"],
  [/\breadiness\b/gi, "就绪度"],
  [/\bassumptions\b/gi, "假设"],
  [/\blongTailRisk\b/gi, "长尾风险"],
  [/\bhallucinationRisks\b/gi, "幻觉风险"],
  [/\bkeyAssumptions\b/gi, "关键假设"],
  [/\boverallConfidence\b/gi, "整体可信度"],
  [/\bscoreAlignment\b/gi, "评分一致性"],
  [/\brelevanceCheck\b/gi, "相关性检查"],
];

function sanitizeThinkingText(text: string): string {
  // Remove code fences
  let cleaned = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`{1,2}[^`\n]+`{1,2}/g, "");

  // Remove inline JSON objects (balanced {…} containing "key": patterns)
  cleaned = cleaned.replace(/\{[^{}]*"[^"]+":\s*[^{}]*\}/g, "");

  // Replace English schema names with Chinese
  for (const [pattern, replacement] of TERM_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  const metaPatterns: RegExp[] = [
    /\bjson\b/i,
    /\bmarkdown\b/i,
    /代码块/,
    /输出格式/,
    /字段填充/,
    /(构造|生成|输出|填充|组装)\s*(json|markdown|响应|结果)/i,
    /(被要求|需要|必须).{0,10}(json|输出|markdown|格式)/i,
    /^(我们|你|我).{0,5}(需要|必须|应该|被要求|要).{0,10}(输出|生成|json|markdown|格式)/i,
    /^(最后|开始|准备|现在|接下来).{0,8}(输出|生成|构造|创建)\s*(json|响应)?/i,
  ];

  return cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => {
      if (!p) return false;

      // Detect JSON-like paragraphs (contain key-value patterns)
      const lines = p.split("\n");
      const kvLines = lines.filter((l) => /^\s*"[^"]+":\s*/.test(l));
      if (kvLines.length > 0 && kvLines.length / lines.length > 0.3) return false;
      if (/^[{[]/.test(p) && kvLines.length > 1) return false;
      if (lines.some((l) => l.trim() === "{") && kvLines.length > 0) return false;

      return !metaPatterns.some((pat) => pat.test(p));
    })
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function RenderMarkdown({ content }: { content: string }) {
  // Lightweight Markdown → plain text rendering for inline display.
  // Splits on double-newline for paragraphs, handles **bold**, *italic*,
  // `code`, and unordered list items (- / *).
  if (!content) return null;

  const paragraphs = content.split(/\n\n+/);
  return (
    <>
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n");
        return (
          <div key={pi} className={pi > 0 ? "mt-1.5" : ""}>
            {lines.map((line, li) => {
              // unordered list item
              const listMatch = line.match(/^[-*]\s+(.+)/);
              if (listMatch) {
                return (
                  <div
                    key={li}
                    className="flex items-start gap-1.5 ml-1"
                  >
                    <span className="text-muted-foreground/60">-</span>
                    <span>
                      <InlineMarkdown text={listMatch[1]} />
                    </span>
                  </div>
                );
              }

              // heading
              const headingMatch = line.match(/^#{1,3}\s+(.+)/);
              if (headingMatch) {
                const size =
                  headingMatch[0].startsWith("###")
                    ? "text-xs"
                    : headingMatch[0].startsWith("##")
                      ? "text-sm"
                      : "text-base";
                return (
                  <p
                    key={li}
                    className={`${size} font-semibold text-foreground mt-1 mb-0.5`}
                  >
                    <InlineMarkdown text={headingMatch[1]} />
                  </p>
                );
              }

              return (
                <p key={li}>
                  <InlineMarkdown text={line} />
                </p>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // Renders **bold**, *italic*, `code` within a single line, returns array of spans.
  if (!text) return null;

  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="bg-muted px-1 py-0.5 rounded text-primary/80 font-mono text-[10px]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
