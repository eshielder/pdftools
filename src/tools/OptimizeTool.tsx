import { useCallback, useState } from "react";
import { Gauge, Info } from "lucide-react";
import { optimizePdf } from "../lib/pdf";
import { fileToUint8, isPdfFile } from "../lib/image";
import { downloadBlob, bytesToBlob } from "../lib/download";
import { baseName, formatBytes } from "../lib/format";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import Spinner from "./components/Spinner";

export default function OptimizeTool() {
  const [fileName, setFileName] = useState("");
  const [buffer, setBuffer] = useState<Uint8Array | null>(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; name: string; size: number } | null>(null);

  const addFile = useCallback((incoming: File[]) => {
    const file = incoming.find(isPdfFile);
    if (!file) {
      setError("That doesn't look like a PDF. Please choose a .pdf file.");
      return;
    }
    setError(null);
    setResult(null);
    void (async () => {
      setBusy(true);
      try {
        const bytes = await fileToUint8(file);
        setFileName(file.name);
        setBuffer(bytes);
        setOriginalSize(bytes.byteLength);
      } catch {
        setError("We couldn't read that file.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const reset = () => {
    setBuffer(null);
    setFileName("");
    setResult(null);
    setError(null);
  };

  const runOptimize = async () => {
    if (!buffer) return;
    setError(null);
    setBusy(true);
    try {
      const out = await optimizePdf(buffer);
      setResult({
        bytes: out,
        name: `${baseName(fileName) || "optimized"}-optimized.pdf`,
        size: out.byteLength,
      });
    } catch {
      setError("We couldn't optimize that PDF. It may be corrupted or already optimized.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    downloadBlob(bytesToBlob(result.bytes, "application/pdf"), result.name);
  };

  if (result) {
    const saved = Math.max(0, originalSize - result.size);
    const pct = originalSize > 0 ? Math.round((saved / originalSize) * 100) : 0;
    return (
      <ResultCard
        message={saved > 0 ? `Reduced by ${formatBytes(saved)} (${pct}%).` : "File is already optimized."}
        filename={result.name}
        sizeLabel={`${formatBytes(originalSize)} → ${formatBytes(result.size)}`}
        onDownload={download}
        onReset={reset}
      >
        <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3 text-center">
          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-xs font-medium text-foreground/60">Before</p>
            <p className="mt-1 text-lg font-bold text-foreground">{formatBytes(originalSize)}</p>
          </div>
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
            <p className="text-xs font-medium text-foreground/60">After</p>
            <p className="mt-1 text-lg font-bold text-accent">{formatBytes(result.size)}</p>
          </div>
        </div>
      </ResultCard>
    );
  }

  return (
    <div>
      <DropZone
        accept="application/pdf,.pdf"
        label="Drop a PDF here, or click to browse"
        hint="We'll strip unused data and recompress to make it smaller"
        onFiles={addFile}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {buffer && (
        <div className="mt-6 rounded-2xl border border-border bg-white p-6 text-center shadow-sm">
          <p className="truncate text-sm font-semibold text-foreground">{fileName}</p>
          <p className="mt-1 text-sm text-foreground/60">
            Original size: <span className="font-bold text-foreground">{formatBytes(originalSize)}</span>
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void runOptimize()}
              disabled={busy}
              className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Gauge className="h-4 w-4" aria-hidden="true" />
              Optimize PDF
            </button>
            {busy && <Spinner label="Optimizing your PDF…" />}
          </div>
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-white/70 px-4 py-3 text-xs leading-relaxed text-foreground/60">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          The PRD called for qpdf-wasm (linearization + recompression), but that package is an
          undocumented Emscripten CLI build that requires cross-origin isolation (COOP/COEP)
          headers the hosting platform doesn't serve, so it can't run reliably in the browser.
          This tool uses pdf-lib's stream recompression instead — files are processed 100%
          locally, nothing is uploaded.
        </span>
      </p>
    </div>
  );
}
