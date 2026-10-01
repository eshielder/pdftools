import { useState } from "react";
import { Download, ImageDown } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf, pageToImageBlob } from "../lib/pdfjs";
import { fileToUint8, isPdfFile } from "../lib/image";
import { downloadBlob, downloadZip } from "../lib/download";
import { baseName, expandRanges, parsePageRanges } from "../lib/format";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import Spinner from "./components/Spinner";
import { Field, Segmented } from "./components/Controls";

interface PdfState {
  name: string;
  size: number;
  bytes: Uint8Array;
}

interface OutputImage {
  name: string;
  blob: Blob;
}

type Dpi = "72" | "150" | "300";

export default function PdfToImageTool() {
  const [pdfFile, setPdfFile] = useState<PdfState | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [dpi, setDpi] = useState<Dpi>("150");
  const [quality, setQuality] = useState(0.9);
  const [selection, setSelection] = useState<"all" | "pages">("all");
  const [pageSpec, setPageSpec] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OutputImage[] | null>(null);

  const reset = () => {
    if (doc) void doc.destroy();
    setDoc(null);
    setPdfFile(null);
    setPageCount(0);
    setResult(null);
    setError(null);
    setPageSpec("");
    setSelection("all");
  };

  const addFile = (incoming: File[]) => {
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        let file: File | undefined;
        for (const f of incoming) {
          if (await isPdfFile(f)) {
            file = f;
            break;
          }
        }
        if (!file) {
          setError("That doesn't look like a PDF. Please choose a .pdf file.");
          setLoading(false);
          return;
        }

        const bytes = await fileToUint8(file);
        const loaded = await loadPdf(bytes);
        if (doc) void doc.destroy();
        setPdfFile({ name: file.name || "document.pdf", size: bytes.byteLength, bytes });
        setDoc(loaded);
        setPageCount(loaded.numPages);
        setResult(null);
      } catch (err) {
        console.error("PdfToImageTool load error", err);
        setError("We couldn't read that PDF. It may be corrupt or password-protected.");
      } finally {
        setLoading(false);
      }
    })();
  };

  const run = async () => {
    if (!doc) return;
    let pages: number[];
    if (selection === "pages") {
      const parsed = parsePageRanges(pageSpec, pageCount);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      pages = expandRanges(parsed.ranges);
    } else {
      pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    }

    setBusy(true);
    setError(null);
    try {
      const ext = format === "png" ? "png" : "jpg";
      const base = baseName(pdfFile!.name);
      const files: OutputImage[] = [];
      for (const pageNumber of pages) {
        const blob = await pageToImageBlob(doc, pageNumber, {
          format,
          quality,
          scale: Number(dpi) / 72,
        });
        files.push({ name: `${base}-page-${pageNumber}.${ext}`, blob });
      }
      setResult(files);
    } catch {
      setError("We couldn't convert those pages. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result || result.length === 0) return;
    if (result.length === 1) {
      downloadBlob(result[0].blob, result[0].name);
      return;
    }
    void downloadZip(result, `${baseName(pdfFile!.name)}-images.zip`);
  };

  if (result) {
    return (
      <ResultCard
        message={result.length === 1 ? "Your page is ready." : `${result.length} images are ready.`}
        filename={result.length === 1 ? result[0].name : `${result.length} images`}
        downloadLabel={result.length === 1 ? "Download image" : "Download all (ZIP)"}
        onDownload={download}
        onReset={reset}
      >
        {result.length > 1 && (
          <ul className="mt-2 grid w-full gap-2 sm:grid-cols-2">
            {result.map((f) => (
              <li key={f.name}>
                <button
                  type="button"
                  onClick={() => downloadBlob(f.blob, f.name)}
                  className="press flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <span className="truncate">{f.name}</span>
                  <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </ResultCard>
    );
  }

  return (
    <div>
      <DropZone
        accept="application/pdf,application/x-pdf,.pdf"
        label="Drop a PDF here, or click to browse"
        hint="We'll render each page as an image"
        onFiles={addFile}
        disabled={loading || busy}
      />
      {loading && <Spinner label="Opening your PDF…" />}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {doc && pdfFile && (
        <div className="mt-6 space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-foreground/70">
            <span className="font-semibold text-foreground">{pdfFile.name}</span> ·{" "}
            {pageCount} page{pageCount === 1 ? "" : "s"}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Segmented
              label="Format"
              value={format}
              onChange={setFormat}
              options={[
                { value: "png", label: "PNG" },
                { value: "jpeg", label: "JPG" },
              ]}
            />
            <Segmented
              label="Resolution"
              value={dpi}
              onChange={setDpi}
              options={[
                { value: "72", label: "72 dpi" },
                { value: "150", label: "150 dpi" },
                { value: "300", label: "300 dpi" },
              ]}
            />
            <Segmented
              label="Pages"
              value={selection}
              onChange={setSelection}
              options={[
                { value: "all", label: "All pages" },
                { value: "pages", label: "Specific pages" },
              ]}
            />
            {format === "jpeg" && (
              <Field label={`JPG quality: ${Math.round(quality * 100)}%`}>
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.05}
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                />
              </Field>
            )}
          </div>
          {selection === "pages" && (
            <Field label="Page numbers" hint="e.g. 1-3, 5, 7-9">
              <input
                type="text"
                value={pageSpec}
                onChange={(e) => setPageSpec(e.target.value)}
                placeholder="1-3, 5"
                className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-2 focus:outline-ring"
              />
            </Field>
          )}
          <div className="flex flex-col items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void run()}
              disabled={busy}
              className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImageDown className="h-4 w-4" aria-hidden="true" />
              Convert pages
            </button>
            {busy && <Spinner label="Converting pages…" />}
          </div>
        </div>
      )}
    </div>
  );
}
