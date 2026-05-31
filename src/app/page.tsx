"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { InputPanel } from "@/components/input-panel";
import { ResultPanel } from "@/components/result-panel";
import { getCachedResult, setCachedResult } from "@/lib/cache";
import {
  detectCompletedSections,
  extractStringField,
  extractNumberField,
  extractPartialArrayItems,
} from "@/lib/streaming-detector";
import type {
  GenerationResponse,
  StreamEvent,
  PartialGenerationResponse,
  PainPoint,
  VlmNode,
  McpIntegration,
  HitlDesign,
} from "@/lib/schemas";

export interface RetryStatus {
  attempt: number;
  maxRetries: number;
  message: string;
}

export default function Home() {
  const [productName, setProductName] = useState("");
  const [schemeText, setSchemeText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultData, setResultData] = useState<GenerationResponse | undefined>(
    undefined
  );
  const [rawTextFallback, setRawTextFallback] = useState<string | undefined>(
    undefined
  );
  const [showShortInputWarning, setShowShortInputWarning] = useState(false);
  const [retryStatus, setRetryStatus] = useState<RetryStatus | null>(null);
  const [isCachedResult, setIsCachedResult] = useState(false);
  const [errorSuggestion, setErrorSuggestion] = useState<string | undefined>(
    undefined
  );
  const [streamInterrupted, setStreamInterrupted] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [thinkingText, setThinkingText] = useState("");
  const [partialResult, setPartialResult] = useState<
    PartialGenerationResponse | undefined
  >(undefined);
  const detectedSectionsRef = useRef<Set<string>>(new Set());
  const detectedItemIndicesRef = useRef<Map<string, Set<number>>>(new Map());
  const streamingTextRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<string>>(
    new Set()
  );

  const SHORT_INPUT_THRESHOLD = 100;

  const handleGenerate = async (forceGenerate = false) => {
    if (!forceGenerate && schemeText.trim().length < SHORT_INPUT_THRESHOLD) {
      setShowShortInputWarning(true);
      setResultData(undefined);
      setRawTextFallback(undefined);
      setRetryStatus(null);
      return;
    }

    setIsGenerating(true);
    setResultData(undefined);
    setRawTextFallback(undefined);
    setShowShortInputWarning(false);
    setIsCachedResult(false);
    setErrorSuggestion(undefined);
    setStreamInterrupted(false);
    setRetryStatus(null);
    setStreamingText("");
    setThinkingText("");
    setPartialResult(undefined);
    detectedSectionsRef.current = new Set();
    detectedItemIndicesRef.current = new Map();
    streamingTextRef.current = "";
    setCompletedSections(new Set());

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          solutionContent: schemeText.trim(),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Non-streaming error (e.g. 400 validation)
        const json = await res.json().catch(() => null);
        toast.error(json?.message || "生成失败，请重试");
        if (json?.rawText) {
          setRawTextFallback(json.rawText);
        }
        setIsGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        toast.error("无法读取服务响应");
        setIsGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "thinking_text") {
            setRetryStatus(null);
            setThinkingText(event.text);
          } else if (event.type === "token") {
            setRetryStatus(null);

            streamingTextRef.current += event.token;
            setStreamingText(streamingTextRef.current);

            const text = streamingTextRef.current;

            // ── Extract data outside state updater (side-effect-free reads) ──

            const summary = extractStringField(text, "summary");
            const productNameFromStream = extractStringField(text, "productName");
            const score = extractNumberField(text, "score");

            // Partial array items (mutate refs here, not inside updater)
            const sectionKeys = ["painPoints", "vlmNodes", "mcpIntegration", "hitlDesign"] as const;
            const newPartialItems: Record<string, unknown[]> = {};
            for (const key of sectionKeys) {
              if (detectedSectionsRef.current.has(key)) continue;
              let indices = detectedItemIndicesRef.current.get(key);
              if (!indices) {
                indices = new Set<number>();
                detectedItemIndicesRef.current.set(key, indices);
              }
              const items = extractPartialArrayItems(text, key, indices);
              if (items.length > 0) {
                newPartialItems[key] = [];
                for (const item of items) {
                  indices.add(item.index);
                  newPartialItems[key].push(item.data);
                }
              }
            }

            // Full array detection
            const newSections = detectCompletedSections(text, detectedSectionsRef.current);
            for (const s of newSections) {
              detectedSectionsRef.current.add(s.key);
            }
            if (newSections.length > 0) {
              setCompletedSections((prev) => {
                const next = new Set(prev);
                for (const s of newSections) next.add(s.key);
                return next;
              });
            }

            // ── Pure state update ──
            const hasNewData =
              summary ||
              productNameFromStream ||
              score != null ||
              Object.keys(newPartialItems).length > 0 ||
              newSections.length > 0;

            if (hasNewData) {
              setPartialResult((prev) => {
                const next = { ...prev };
                if (summary) next.summary = summary;
                if (productNameFromStream) next.productName = productNameFromStream;
                if (score != null) next.score = score;

                for (const [key, items] of Object.entries(newPartialItems)) {
                  const raw = (next as Record<string, unknown>)[key];
                  const existing: unknown[] = Array.isArray(raw) ? [...raw] : [];
                  for (const item of items) existing.push(item);
                  (next as Record<string, unknown>)[key] = existing;
                }

                for (const s of newSections) {
                  if (s.key === "painPoints") next.painPoints = s.data as PainPoint[];
                  else if (s.key === "vlmNodes") next.vlmNodes = s.data as VlmNode[];
                  else if (s.key === "mcpIntegration") next.mcpIntegration = s.data as McpIntegration[];
                  else if (s.key === "hitlDesign") next.hitlDesign = s.data as HitlDesign[];
                }

                return next;
              });
            }
          } else if (event.type === "progress") {
            setRetryStatus({
              attempt: event.attempt ?? 0,
              maxRetries: event.maxRetries ?? 0,
              message: event.message,
            });
          } else if (event.type === "result") {
            if (!event.success) {
              // If we have partial content, show interrupted state instead of cache/error
              if (streamingTextRef.current) {
                setStreamInterrupted(true);
                setRetryStatus(null);
                toast.error("生成中断，已输出部分内容如下。您可尝试重新生成");
                return;
              }

              setStreamingText("");
              setPartialResult(undefined);
              setErrorSuggestion(event.suggestion);
              if (event.rawText) {
                setRawTextFallback(event.rawText);
              }

              const cached = getCachedResult(
                productName.trim(),
                schemeText.trim()
              );
              if (cached) {
                setResultData(cached);
                setIsCachedResult(true);
                toast.warning("AI 服务暂时不可用，已为您加载缓存数据");
                return;
              }

              toast.error(event.message || "生成失败，请重试");
              return;
            }

            setStreamingText("");
            setPartialResult(undefined);
            setCachedResult(
              productName.trim(),
              schemeText.trim(),
              event.data
            );
            setResultData(event.data);
          }
        }
      }
    } catch (err: unknown) {
      setRetryStatus(null);

      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const hasPartialContent = !!streamingTextRef.current;

      if (isAbort) {
        if (hasPartialContent) {
          setStreamInterrupted(true);
          toast.info("已停止生成，部分内容已保留");
        }
        // If no content yet, just silently reset to empty state
      } else if (hasPartialContent) {
        setStreamInterrupted(true);
        toast.error("生成中断，已输出部分内容如下。可点击「重新生成」按钮重试");
      } else {
        const cached = getCachedResult(productName.trim(), schemeText.trim());
        if (cached) {
          setResultData(cached);
          setIsCachedResult(true);
          toast.warning("网络请求失败，已为您加载缓存数据");
        } else {
          toast.error("网络请求失败，请检查网络连接后重试");
        }
      }
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleFileContentRead = (content: string) => {
    setSchemeText(content);
    setShowShortInputWarning(false);
  };

  const handleForceGenerate = () => {
    handleGenerate(true);
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const handleDismissWarning = () => {
    setShowShortInputWarning(false);
  };

  const handleProductNameChange = (v: string) => {
    setProductName(v);
    setShowShortInputWarning(false);
  };

  const handleSchemeTextChange = (v: string) => {
    setSchemeText(v);
    setShowShortInputWarning(false);
  };

  const hasResult = !!resultData;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top nav bar */}
      <header className="flex items-center justify-between px-6 h-12 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_1px_var(--glow-blue)]" />
            <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest">
              Visual Reconstruction Engine
            </span>
          </div>
          <span className="text-border">|</span>
          <span className="text-[11px] text-muted-foreground/60">v1.0.0-beta</span>
        </div>
        <div className="flex items-center gap-4">
          {["文档", "API", "设置"].map((item) => (
            <button
              key={item}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {item}
            </button>
          ))}
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">PM</span>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-[380px] flex-shrink-0 border-r border-border bg-card/30 p-5 overflow-hidden">
          <InputPanel
            productName={productName}
            onProductNameChange={handleProductNameChange}
            schemeText={schemeText}
            onSchemeTextChange={handleSchemeTextChange}
            onFileContentRead={handleFileContentRead}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        </div>

        {/* Right panel */}
        <div className="flex-1 p-5 overflow-hidden flex flex-col min-w-0">
          <ResultPanel
            productName={productName}
            isGenerating={isGenerating}
            hasResult={hasResult}
            data={resultData}
            rawTextFallback={rawTextFallback}
            streamingText={streamingText}
            thinkingText={thinkingText}
            completedSections={completedSections}
            partialResult={partialResult}
            showShortInputWarning={showShortInputWarning}
            retryStatus={retryStatus}
            isCachedResult={isCachedResult}
            errorSuggestion={errorSuggestion}
            streamInterrupted={streamInterrupted}
            onForceGenerate={handleForceGenerate}
            onDismissWarning={handleDismissWarning}
            onCancel={handleCancel}
          />
        </div>
      </main>
    </div>
  );
}
