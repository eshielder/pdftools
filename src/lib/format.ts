export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "file";
}

export type ParseRangesResult =
  | { ok: true; ranges: Array<[number, number]> }
  | { ok: false; error: string };

/** Parses a spec like "1-3, 5, 7-9" into 1-based inclusive page ranges. */
export function parsePageRanges(spec: string, totalPages: number): ParseRangesResult {
  const tokens = spec
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return { ok: false, error: "Enter at least one page or range." };
  }

  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (rangeMatch) {
      const a = parseInt(rangeMatch[1], 10);
      const b = parseInt(rangeMatch[2], 10);
      if (a < 1 || b < a) return { ok: false, error: `Invalid range "${token}".` };
      if (b > totalPages) {
        return { ok: false, error: `Range "${token}" exceeds the document (${totalPages} pages).` };
      }
      ranges.push([a, b]);
    } else if (/^\d+$/.test(token)) {
      const p = parseInt(token, 10);
      if (p < 1 || p > totalPages) {
        return { ok: false, error: `Page ${p} is out of range (document has ${totalPages} pages).` };
      }
      ranges.push([p, p]);
    } else {
      return { ok: false, error: `Could not understand "${token}". Use formats like 1, 3-5.` };
    }
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], r[1]);
    } else {
      merged.push(r);
    }
  }
  return { ok: true, ranges: merged };
}

/** Expands 1-based inclusive ranges into an array of page numbers. */
export function expandRanges(ranges: Array<[number, number]>): number[] {
  const pages: number[] = [];
  for (const [a, b] of ranges) {
    for (let p = a; p <= b; p += 1) pages.push(p);
  }
  return pages;
}
