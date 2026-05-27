import type { GenerationResponse } from "./schemas";

const severityLabel: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};
const readinessLabel: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export function generateMarkdownExport(
  data: GenerationResponse,
  originalProductName: string
): string {
  const title = originalProductName
    ? `${originalProductName} 重构推演白皮书`
    : "重构推演白皮书";

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> 替代潜力评分：**${data.score} / 100**`);
  lines.push("");
  lines.push("## 执行摘要");
  lines.push("");
  lines.push(data.summary);
  lines.push("");

  // Pain Points
  lines.push("---");
  lines.push("");
  lines.push("## 痛点分析");
  lines.push("");
  lines.push(
    `| # | 痛点 | 严重程度 | 分析 | 长尾风险评估 |`
  );
  lines.push(
    `|---|---|---|---|---|`
  );
  data.painPoints.forEach((p, i) => {
    const analysis = p.analysis.replace(/\n/g, "<br>");
    const longTail = p.longTailRisk.replace(/\n/g, "<br>");
    lines.push(
      `| ${i + 1} | ${p.title} | ${severityLabel[p.severity]} | ${analysis} | ${longTail} |`
    );
  });
  lines.push("");

  // VLM Nodes
  lines.push("---");
  lines.push("");
  lines.push("## VLM 替代节点");
  lines.push("");
  lines.push(
    `| # | 替代环节 | 传统方案 | VLM+Agent 方案 | 预期收益 | 就绪度 |`
  );
  lines.push(
    `|---|---|---|---|---|---|`
  );
  data.vlmNodes.forEach((n, i) => {
    lines.push(
      `| ${i + 1} | ${n.stage} | ${n.traditional} | ${n.vlm} | ${n.gain} | ${readinessLabel[n.readiness]} |`
    );
  });
  lines.push("");

  // MCP Integration
  lines.push("---");
  lines.push("");
  lines.push("## MCP 数据接入方案");
  lines.push("");

  data.mcpIntegration.forEach((m, i) => {
    lines.push(`### ${i + 1}. ${m.type} — ${m.source}`);
    lines.push("");
    lines.push(`**接入方法：** ${m.method}`);
    lines.push("");
    lines.push(`**目的：** ${m.purpose}`);
    lines.push("");
  });

  // HITL Design
  lines.push("---");
  lines.push("");
  lines.push("## 人机协同设计（HITL）");
  lines.push("");

  data.hitlDesign.forEach((h, i) => {
    lines.push(`### ${i + 1}. ${h.trigger}`);
    lines.push("");
    lines.push(`- **风险：** ${h.risk}`);
    lines.push(`- **兜底策略：** ${h.strategy}`);
    lines.push(`- **降级方案：** ${h.fallback}`);
    lines.push("");
  });

  lines.push("---");
  lines.push("");
  lines.push(
    `*本白皮书由传统视觉AI重构推演助手自动生成，仅供决策参考。*`
  );

  return lines.join("\n");
}
