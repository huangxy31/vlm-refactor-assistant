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

export interface DetectedItem {
  index: number;
  data: PainPoint | VlmNode | McpIntegration | HitlDesign;
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

/**
 * Extracts a completed JSON string field value from partial streaming text.
 * Finds `"fieldName": "..."` and returns the unescaped string if the closing quote is present.
 */
export function extractStringField(text: string, fieldName: string): string | null {
  const keyPattern = `"${fieldName}"`;
  const keyIdx = text.indexOf(keyPattern);
  if (keyIdx === -1) return null;

  const colonIdx = text.indexOf(":", keyIdx + keyPattern.length);
  if (colonIdx === -1) return null;

  let quoteStart = -1;
  for (let i = colonIdx + 1; i < text.length; i++) {
    if (text[i] === '"') {
      quoteStart = i;
      break;
    }
    if (text[i] !== " " && text[i] !== "\n" && text[i] !== "\t" && text[i] !== "\r") return null;
  }
  if (quoteStart === -1) return null;

  let escaped = false;
  for (let i = quoteStart + 1; i < text.length; i++) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (text[i] === "\\") {
      escaped = true;
      continue;
    }
    if (text[i] === '"') {
      try {
        return JSON.parse(text.slice(quoteStart, i + 1));
      } catch {
        return null;
      }
    }
  }

  return null; // string not yet closed
}

/**
 * Extracts a completed JSON number field value from partial streaming text.
 * Only returns the number when followed by a valid JSON terminator (comma, brace, bracket, whitespace).
 */
export function extractNumberField(text: string, fieldName: string): number | null {
  const keyPattern = `"${fieldName}"`;
  const keyIdx = text.indexOf(keyPattern);
  if (keyIdx === -1) return null;

  const colonIdx = text.indexOf(":", keyIdx + keyPattern.length);
  if (colonIdx === -1) return null;

  let start = -1;
  for (let i = colonIdx + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") continue;
    if (ch === "-" || ch === "." || (ch >= "0" && ch <= "9")) {
      start = i;
      break;
    }
    return null;
  }
  if (start === -1) return null;

  let end = start;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (
      (ch >= "0" && ch <= "9") ||
      ch === "." ||
      ch === "e" ||
      ch === "E" ||
      ch === "+" ||
      ch === "-"
    ) {
      end = i;
    } else {
      break;
    }
  }

  // Don't return if number is at the very end — it may still be growing
  if (end + 1 >= text.length) return null;

  const after = text[end + 1];
  if (
    after === "," ||
    after === "}" ||
    after === "]" ||
    after === "\n" ||
    after === "\r" ||
    after === " " ||
    after === "\t"
  ) {
    const num = Number(text.slice(start, end + 1));
    return isNaN(num) || !isFinite(num) ? null : num;
  }

  return null;
}

/**
 * Extracts individual completed JSON objects from within a partially-streamed array.
 * Returns items whose index is not in `alreadyDetectedIndices`.
 */
export function extractPartialArrayItems(
  text: string,
  sectionKey: SectionKey,
  alreadyDetectedIndices: ReadonlySet<number>,
): DetectedItem[] {
  const results: DetectedItem[] = [];

  const keyPattern = `"${sectionKey}"`;
  const keyIdx = text.indexOf(keyPattern);
  if (keyIdx === -1) return results;

  const colonIdx = text.indexOf(":", keyIdx + keyPattern.length);
  if (colonIdx === -1) return results;

  let arrStart = -1;
  for (let i = colonIdx + 1; i < text.length; i++) {
    if (text[i] === "[") {
      arrStart = i;
      break;
    }
    if (text[i] !== " " && text[i] !== "\n" && text[i] !== "\t" && text[i] !== "\r") break;
  }
  if (arrStart === -1) return results;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let objectStart = -1;
  let itemIndex = 0;

  for (let i = arrStart + 1; i < text.length; i++) {
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

    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        if (!alreadyDetectedIndices.has(itemIndex)) {
          const objJson = text.slice(objectStart, i + 1);
          const parsed = tryParseItem(objJson, sectionKey);
          if (parsed !== null) {
            results.push({ index: itemIndex, data: parsed });
          }
        }
        itemIndex++;
        objectStart = -1;
      }
    } else if (ch === "]" && depth === 0) {
      break;
    }
  }

  return results;
}

function tryParseItem(
  json: string,
  section: SectionKey,
): PainPoint | VlmNode | McpIntegration | HitlDesign | null {
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return null;
  }

  const schema = SECTION_SCHEMAS[section];
  const result = schema.safeParse(obj);
  return result.success ? (result.data as PainPoint | VlmNode | McpIntegration | HitlDesign) : null;
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
