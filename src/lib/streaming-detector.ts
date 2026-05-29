import {
  PainPointSchema,
  VlmNodeSchema,
  McpIntegrationSchema,
  HitlDesignSchema,
  type PainPoint,
  type VlmNode,
  type McpIntegration,
  type HitlDesign,
} from "./schemas";

const SECTION_KEYS = [
  "painPoints",
  "vlmNodes",
  "mcpIntegration",
  "hitlDesign",
] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_SCHEMAS = {
  painPoints: PainPointSchema,
  vlmNodes: VlmNodeSchema,
  mcpIntegration: McpIntegrationSchema,
  hitlDesign: HitlDesignSchema,
} as const;

export interface DetectedSection {
  key: SectionKey;
  data: PainPoint[] | VlmNode[] | McpIntegration[] | HitlDesign[];
}

/**
 * Detects completed JSON array sections in partial streaming text.
 * Uses bracket-balancing with string-escaping awareness to find
 * when a top-level array like `"painPoints": [...]` is fully closed.
 */
export function detectCompletedSections(
  text: string,
  alreadyDetected: ReadonlySet<string>
): DetectedSection[] {
  const results: DetectedSection[] = [];

  for (const section of SECTION_KEYS) {
    if (alreadyDetected.has(section)) continue;

    const arrayJson = extractArrayJson(text, section);
    if (arrayJson === null) continue;

    const parsed = tryParseSectionArray(arrayJson, section);
    if (parsed !== null) {
      results.push({ key: section, data: parsed });
    }
  }

  return results;
}

function extractArrayJson(
  text: string,
  section: string
): string | null {
  const keyPattern = `"${section}"`;
  const keyIdx = text.indexOf(keyPattern);
  if (keyIdx === -1) return null;

  const colonIdx = text.indexOf(":", keyIdx + keyPattern.length);
  if (colonIdx === -1) return null;

  let startIdx = -1;
  for (let i = colonIdx + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "[") {
      startIdx = i;
      break;
    }
    if (ch !== " " && ch !== "\n" && ch !== "\t" && ch !== "\r") break;
  }
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }

  return null;
}

function tryParseSectionArray(
  json: string,
  section: SectionKey
): PainPoint[] | VlmNode[] | McpIntegration[] | HitlDesign[] | null {
  let arr: unknown;
  try {
    arr = JSON.parse(json);
  } catch {
    return null;
  }

  if (!Array.isArray(arr)) return null;

  const schema = SECTION_SCHEMAS[section];
  const validItems: unknown[] = [];

  for (const item of arr) {
    const result = schema.safeParse(item);
    if (result.success) {
      validItems.push(result.data);
    }
  }

  if (validItems.length === 0) return null;

  return validItems as PainPoint[] | VlmNode[] | McpIntegration[] | HitlDesign[];
}
