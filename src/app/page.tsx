"use client";

import { useState } from "react";
import { toast } from "sonner";
import { InputPanel } from "@/components/input-panel";
import { ResultPanel } from "@/components/result-panel";
import { getCachedResult, setCachedResult } from "@/lib/cache";
import type { GenerationResponse, StreamEvent } from "@/lib/schemas";

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
    setRetryStatus(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          solutionContent: schemeText.trim(),
        }),
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

          if (event.type === "progress") {
            setRetryStatus({
              attempt: event.attempt ?? 0,
              maxRetries: event.maxRetries ?? 0,
              message: event.message,
            });
          } else if (event.type === "result") {
            if (!event.success) {
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

            setCachedResult(
              productName.trim(),
              schemeText.trim(),
              event.data
            );
            setResultData(event.data);
          }
        }
      }
    } catch {
      setRetryStatus(null);

      const cached = getCachedResult(productName.trim(), schemeText.trim());
      if (cached) {
        setResultData(cached);
        setIsCachedResult(true);
        toast.warning("网络请求失败，已为您加载缓存数据");
      } else {
        toast.error("网络请求失败，请检查网络连接后重试");
      }
    } finally {
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
    <div className="min-h-screen bg-background flex flex-col">
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
        <div className="w-[380px] flex-shrink-0 border-r border-border bg-card/30 p-5 overflow-y-auto">
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
            showShortInputWarning={showShortInputWarning}
            retryStatus={retryStatus}
            isCachedResult={isCachedResult}
            errorSuggestion={errorSuggestion}
            onForceGenerate={handleForceGenerate}
            onDismissWarning={handleDismissWarning}
          />
        </div>
      </main>
    </div>
  );
}
