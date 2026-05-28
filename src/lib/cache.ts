"use client";

import type { GenerationResponse } from "./schemas";

export interface CachedEntry {
  data: GenerationResponse;
  cachedAt: number;
  inputHash: string;
}

const CACHE_PREFIX = "vlm_cache_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ENTRIES = 10;

function hashInput(productName: string, solutionContent: string): string {
  const raw = `${productName}::${solutionContent}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getCacheIndex(): string[] {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}index`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCacheIndex(index: string[]): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}index`, JSON.stringify(index));
  } catch {
    // localStorage unavailable — silent degrade
  }
}

function touchIndex(hash: string): void {
  const index = getCacheIndex();
  const filtered = index.filter((h) => h !== hash);
  filtered.push(hash);
  saveCacheIndex(filtered);
}

export function getCachedResult(
  productName: string,
  solutionContent: string
): GenerationResponse | null {
  try {
    const hash = hashInput(productName, solutionContent);
    const raw = localStorage.getItem(`${CACHE_PREFIX}${hash}`);
    if (!raw) return null;

    const entry: CachedEntry = JSON.parse(raw);
    const age = Date.now() - entry.cachedAt;

    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(`${CACHE_PREFIX}${hash}`);
      const index = getCacheIndex().filter((h) => h !== hash);
      saveCacheIndex(index);
      return null;
    }

    touchIndex(hash);
    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedResult(
  productName: string,
  solutionContent: string,
  data: GenerationResponse
): void {
  try {
    const hash = hashInput(productName, solutionContent);
    const entry: CachedEntry = { data, cachedAt: Date.now(), inputHash: hash };

    localStorage.setItem(`${CACHE_PREFIX}${hash}`, JSON.stringify(entry));

    const index = getCacheIndex();
    const filtered = index.filter((h) => h !== hash);
    filtered.push(hash);

    while (filtered.length > MAX_ENTRIES) {
      const oldest = filtered.shift();
      if (oldest) {
        localStorage.removeItem(`${CACHE_PREFIX}${oldest}`);
      }
    }

    saveCacheIndex(filtered);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      try {
        const index = getCacheIndex();
        const oldest = index.shift();
        if (oldest) localStorage.removeItem(`${CACHE_PREFIX}${oldest}`);
        saveCacheIndex(index);
        setCachedResult(productName, solutionContent, data);
      } catch {
        // unrecoverable
      }
    }
  }
}
