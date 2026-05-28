"use client";

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
  OctagonAlert,
} from "lucide-react";
import { generateMarkdownExport } from "@/lib/markdown-export";
import type { GenerationResponse } from "@/lib/schemas";

interface ResultPanelProps {
  productName: string;
  isGenerating: boolean;
  hasResult: boolean;
  data?: GenerationResponse;
  rawTextFallback?: string;
  showShortInputWarning?: boolean;
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
  showShortInputWarning,
  onForceGenerate,
  onDismissWarning,
}: ResultPanelProps) {
  const docTitle = productName
    ? `${productName}重构推演白皮书.md`
    : "重构推演白皮书.md";

  const handleExport = () => {
    if (!data) return;
    const mdContent = generateMarkdownExport(data, productName);
    const blob = new Blob([mdContent], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productName || "重构推演白皮书"}.md`;
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
          {isGenerating && (
            <span className="flex items-center gap-1 text-[11px] text-primary animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              生成中
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
          disabled={!hasResult || !data}
          onClick={handleExport}
          className="flex-shrink-0 h-8 text-xs border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 disabled:opacity-30 gap-1.5"
        >
          <FileDown className="w-3.5 h-3.5" />
          导出为 .md 文件
        </Button>
      </div>

      {/* Content Area */}
      {showShortInputWarning ? (
        <ShortInputWarning onForceGenerate={onForceGenerate} onDismiss={onDismissWarning} />
      ) : !hasResult && !isGenerating && !rawTextFallback ? (
        <EmptyState />
      ) : isGenerating ? (
        <LoadingState />
      ) : data ? (
        <ResultContent productName={productName} data={data} />
      ) : rawTextFallback ? (
        <RawTextFallback rawText={rawTextFallback} />
      ) : (
        <EmptyState />
      )}
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

function LoadingState() {
  return (
    <div className="flex-1 flex flex-col gap-3 min-h-[400px]">
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

function ResultContent({
  productName,
  data,
}: {
  productName: string;
  data: GenerationResponse;
}) {
  const stats = [
    { label: "识别痛点", value: `${data.painPoints.length} 项` },
    { label: "替代节点", value: `${data.vlmNodes.length} 个` },
    { label: "MCP 接入源", value: `${data.mcpIntegration.length} 类` },
    { label: "HITL 策略", value: `${data.hitlDesign.length} 种` },
  ];

  return (
    <div className="flex-1 overflow-y-auto pr-1">
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
              <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-lg">
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

function RawTextFallback({ rawText }: { rawText: string }) {
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
                模型未能按预期 JSON 格式返回结果，以下为原始输出内容，可复制后手动分析或重试生成。
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
