import { useCallback, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Scissors, Download } from "lucide-react";
import { splitPdf } from "../lib/pdf";
import { fileToUint8, isPdfFile } from "../lib/image";
import { downloadBlob, downloadZip, bytesToBlob } from "../lib/download";
import { baseName, formatBytes, parsePageRanges } from "../lib/format";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import Spinner from "./components/Spinner";
import { Field, Segmented } from "./components/Controls";

type SplitMode = "ranges" | "every-n";

interface SplitPart {
  name: string;
  size: number;
  blob: Blob;
}

export default function SplitTool() {
  const [fileName, setFileName] = useState<string>("");
  const [buffer, setBuffer] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [rangesInput, setRangesInput] = useState("1-3");
  const [chunkSize, setChunkSize] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parts, setParts] = useState<SplitPart[] | null>(null);

  const addFile = useCallback((incoming: File[]) => {
    setError(null);
    setParts(null);
    void (async () => {
      let file: File | undefined;
      for (const f of incoming) {
        if (await isPdfFile(f)) {
          file = f;
          break;
        }
      }
      if (!file) {
        setError("That doesn't look like a PDF. Please choose a .pdf file.");
        return;
      }
      setBusy(true);
      try {
        const bytes = await fileToUint8(file);
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        setFileName(file.name || "document.pdf");
        setBuffer(bytes);
        setPageCount(doc.getPageCount());
      } catch (err) {
        console.error("SplitTool load error", err);
        setError("We couldn't read that PDF. It may be corrupted or password-protected.");
        setBuffer(null);
        setPageCount(0);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const reset = () => {
    setBuffer(null);
    setPageCount(0);
    setFileName("");
    setParts(null);
    setError(null);
  };

  const buildRanges = (): Array<[number, number]> | null => {
    if (!buffer) return null;
    if (mode === "ranges") {
      const parsed = parsePageRanges(rangesInput, pageCount);
      if (!parsed.ok) {
        setError(parsed.error);
        return null;
      }
      return parsed.ranges;
    }
    const n = Math.max(1, chunkSize);
    const ranges: Array<[number, number]> = [];
    for (let a = 1; a <= pageCount; a += n) {
      ranges.push([a, Math.min(a + n - 1, pageCount)]);
    }
    return ranges;
  };

  const runSplit = async () => {
    if (!buffer) return;
    setError(null);
    setBusy(true);
    try {
      const ranges = buildRanges();
      if (!ranges) return;
      const out = await splitPdf(buffer, ranges);
      const base = baseName(fileName) || "split";
      const blobParts: SplitPart[] = out.map((part, i) => {
        const [a, b] = ranges[i];
        const name =
          a === b ? `${base}-page-${a}.pdf` : `${base}-pages-${a}-${b}.pdf`;
        return { name, size: part.bytes.byteLength, blob: bytesToBlob(part.bytes, "application/pdf") };
      });
      setParts(blobParts);
    } catch {
      setError("We couldn't split that PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const downloadAll = () => {
    if (!parts) return;
    void downloadZip(
      parts.map((p) => ({ name: p.name, blob: p.blob })),
      `${baseName(fileName) || "split"}-parts.zip`
    );
  };

  if (parts) {
    return (
      <ResultCard
        message={`Split into ${parts.length} part${parts.length > 1 ? "s" : ""}.`}
        filename={`${baseName(fileName) || "split"}-parts.zip`}
        sizeLabel={formatBytes(parts.reduce((s, p) => s + p.size, 0))}
        downloadLabel="Download all (ZIP)"
        onDownload={downloadAll}
        onReset={reset}
      >
        <ul className="mt-6 w-full max-w-md space-y-2 text-left">
          {parts.map((p) => (
            <li
              key={p.name}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{p.name}</span>
                <span className="text-xs text-foreground/60">{formatBytes(p.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => downloadBlob(p.blob, p.name)}
                className="press inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download
              </button>
            </li>
          ))}
        </ul>
      </ResultCard>
    );
  }

  return (
    <div>
      <DropZone
        accept="application/pdf,application/x-pdf,.pdf"
        label="Drop a PDF here, or click to browse"
        hint="One file at a time — you'll pick which pages to extract"
        onFiles={addFile}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {buffer && pageCount > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{fileName}</p>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {pageCount} page{pageCount > 1 ? "s" : ""}
            </span>
          </div>

          <Segmented
            label="Split mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "ranges", label: "Page ranges" },
              { value: "every-n", label: "Every N pages" },
            ]}
          />

          <div className="mt-5">
            {mode === "ranges" ? (
              <Field label="Pages to extract" hint='Examples: "1-3, 5, 7-9" keeps pages 1, 2, 3, 5, 7, 8 and 9'>
                <input
                  type="text"
                  value={rangesInput}
                  onChange={(e) => setRangesInput(e.target.value)}
                  placeholder="1-3, 5, 7-9"
                  className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </Field>
            ) : (
              <Field label="Pages per part" hint="Each output PDF contains this many pages (last part may be shorter)">
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value, 10) || 1)}
                  className="w-32 rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </Field>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void runSplit()}
              disabled={busy}
              className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Scissors className="h-4 w-4" aria-hidden="true" />
              Split PDF
            </button>
            {busy && <Spinner label="Splitting your PDF…" />}
          </div>
        </div>
      )}
    </div>
  );
}
