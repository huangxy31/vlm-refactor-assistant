"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileText,
  X,
  Cpu,
  Loader2,
  Sparkles,
} from "lucide-react";

interface InputPanelProps {
  productName: string;
  onProductNameChange: (v: string) => void;
  schemeText: string;
  onSchemeTextChange: (v: string) => void;
  onFileContentRead: (content: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function InputPanel({
  productName,
  onProductNameChange,
  schemeText,
  onSchemeTextChange,
  onFileContentRead,
  onGenerate,
  isGenerating,
}: InputPanelProps) {
  const [fileAttached, setFileAttached] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("文件大小超过 10MB 限制，请选择较小的文件");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      onFileContentRead(content);
      setFileInfo({ name: file.name, size: file.size });
      setFileAttached(true);
      if (!productName) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        onProductNameChange(nameWithoutExt);
      }
    };
    reader.onerror = () => {
      alert("文件读取失败，请重试");
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    // reset so re-selecting the same file triggers onChange
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setFileAttached(false);
    setFileInfo(null);
    onSchemeTextChange("");
  };

  return (
    <aside className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 border border-primary/20">
          <Cpu className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground leading-tight tracking-wide">
            传统视觉 AI 重构推演助手
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Visual Reconstruction Deduction Engine
          </p>
        </div>
      </div>

      {/* Product Name */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          产品名称
        </Label>
        <Input
          value={productName}
          onChange={(e) => onProductNameChange(e.target.value)}
          placeholder="例如：智能质检视觉平台 v3.0"
          className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/40 focus-visible:border-primary/60 h-10 text-sm"
        />
      </div>

      {/* Scheme Detail Tabs */}
      <div className="flex flex-col gap-2 flex-1">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          方案详情
        </Label>
        <Tabs defaultValue="direct" className="flex flex-col flex-1 gap-0">
          <TabsList className="w-full bg-muted border border-border rounded-md h-9 p-0.5">
            <TabsTrigger
              value="direct"
              className="flex-1 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground rounded-sm h-full"
            >
              直接输入
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="flex-1 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground rounded-sm h-full"
            >
              上传文件
            </TabsTrigger>
          </TabsList>

          {/* Tab: Direct Input */}
          <TabsContent value="direct" className="mt-3 flex-1 flex flex-col gap-1.5">
            <Textarea
              value={schemeText}
              onChange={(e) => onSchemeTextChange(e.target.value)}
              placeholder={`## 工作流概述\n描述当前传统视觉方案的整体流程...\n\n# 核心痛点\n### 长尾场景处理\n- 无法覆盖低频异常类别\n- 标注数据积累成本高\n\n## 数据集依赖\n现有模型对特定光照条件高度敏感...`}
              className="flex-1 min-h-[240px] resize-none bg-input border-border text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/40 focus-visible:border-primary/60 text-sm leading-relaxed font-mono text-[12.5px]"
            />
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              支持使用 Markdown 语法输入，推荐使用{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-primary/80 font-mono text-[10px]">#</code>、
              <code className="bg-muted px-1 py-0.5 rounded text-primary/80 font-mono text-[10px]">##</code>{" "}
              标注工作流与痛点层级
            </p>
          </TabsContent>

          {/* Tab: File Upload */}
          <TabsContent value="upload" className="mt-3 flex-1 flex flex-col">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.text"
              className="hidden"
              onChange={handleFileChange}
            />
            {!fileAttached ? (
              <div
                onClick={handleClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  flex-1 min-h-[240px] flex flex-col items-center justify-center gap-4
                  border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200
                  ${
                    isDragging
                      ? "border-primary bg-primary/5 shadow-[0_0_24px_-4px_var(--glow-blue)]"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }
                `}
              >
                <div
                  className={`
                  flex items-center justify-center w-14 h-14 rounded-full transition-all duration-200
                  ${isDragging ? "bg-primary/15 shadow-[0_0_20px_-2px_var(--glow-blue)]" : "bg-muted"}
                `}
                >
                  <Upload
                    className={`w-6 h-6 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    拖拽或点击上传传统方案说明
                  </p>
                  <p className="text-xs text-muted-foreground">
                    仅支持{" "}
                    <span className="text-primary font-mono">.md</span> / <span className="text-primary font-mono">.txt</span> 文件，最大 10 MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-[240px] flex flex-col gap-3">
                {/* File card */}
                <div className="flex items-center gap-3 p-3.5 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 flex-shrink-0">
                    <FileText className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {fileInfo?.name || "未知文件"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fileInfo ? formatFileSize(fileInfo.size) : ""}
                    </p>
                  </div>
                  <button
                    onClick={handleRemove}
                    className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    aria-label="删除文件"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Re-upload hint */}
                <div
                  onClick={handleClick}
                  className="flex items-center justify-center gap-2 p-3 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-all text-muted-foreground hover:text-foreground"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="text-xs">重新上传文件</span>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Generate Button */}
      <Button
        onClick={() => onGenerate()}
        disabled={isGenerating || (!productName && !schemeText && !fileAttached)}
        className={`
          w-full h-11 text-sm font-semibold tracking-wide transition-all duration-300
          bg-primary text-primary-foreground
          hover:bg-primary/90
          disabled:opacity-40 disabled:cursor-not-allowed
          ${!isGenerating ? "shadow-[0_0_20px_-4px_var(--glow-blue)] hover:shadow-[0_0_32px_-4px_var(--glow-blue)]" : ""}
        `}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            推演生成中...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            生成推演白皮书
          </>
        )}
      </Button>
    </aside>
  );
}
