import { useState } from "react";
import { PenLine } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf } from "../lib/pdfjs";
import { canvasToPngData, fileToUint8, isPdfFile, renderTypedSignature } from "../lib/image";
import { embedSignature } from "../lib/pdf";
import { bytesToBlob, downloadBlob } from "../lib/download";
import { baseName, formatBytes } from "../lib/format";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import Spinner from "./components/Spinner";
import SignaturePad, { type SignatureData } from "./components/SignaturePad";
import PlacementPage, { type PlacementRect } from "./components/PlacementPage";
import { Field, Segmented } from "./components/Controls";

const PAGE_W = 260;

interface PdfState {
  name: string;
  size: number;
  bytes: Uint8Array;
}

interface PageInfo {
  width: number;
  height: number;
}

export default function SignTool() {
  const [pdfFile, setPdfFile] = useState<PdfState | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageInfo, setPageInfo] = useState<PageInfo[]>([]);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [color, setColor] = useState("#1d4ed8");
  const [typedName, setTypedName] = useState("");
  const [sig, setSig] = useState<SignatureData | null>(null);
  const [placements, setPlacements] = useState<Record<number, { rect: PlacementRect }>>({});
  const [activePage, setActivePage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; name: string; size: number } | null>(null);

  const reset = () => {
    if (doc) void doc.destroy();
    setDoc(null);
    setPdfFile(null);
    setPageCount(0);
    setPageInfo([]);
    setSig(null);
    setPlacements({});
    setActivePage(1);
    setTypedName("");
    setResult(null);
    setError(null);
  };

  const addFile = (incoming: File[]) => {
    const file = incoming.find(isPdfFile);
    if (!file) {
      setError("That doesn't look like a PDF. Please choose a .pdf file.");
      return;
    }
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const bytes = await fileToUint8(file);
        const loaded = await loadPdf(bytes);
        if (doc) void doc.destroy();
        const info: PageInfo[] = [];
        for (let i = 1; i <= loaded.numPages; i += 1) {
          const page = await loaded.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          info.push({ width: vp.width, height: vp.height });
        }
        setPdfFile({ name: file.name, size: bytes.byteLength, bytes });
        setDoc(loaded);
        setPageCount(loaded.numPages);
        setPageInfo(info);
        setSig(null);
        setPlacements({});
        setActivePage(1);
        setResult(null);
      } catch {
        setError("We couldn't read that PDF. It may be corrupt or password-protected.");
      } finally {
        setLoading(false);
      }
    })();
  };

  const applySignature = (s: SignatureData | null) => {
    setSig(s);
    setPlacements({});
  };

  const renderTyped = async () => {
    if (!typedName.trim()) {
      setError("Type your name first, then render it.");
      return;
    }
    setError(null);
    try {
      const canvas = await renderTypedSignature(typedName.trim(), color);
      const d = await canvasToPngData(canvas);
      applySignature({ dataUrl: d.dataUrl, bytes: d.bytes, width: d.width, height: d.height });
    } catch {
      setError("We couldn't render that signature. Please try again.");
    }
  };

  const onPlace = (page: number, rect: PlacementRect) =>
    setPlacements((p) => ({ ...p, [page]: { rect } }));
  const onUpdate = (page: number, rect: PlacementRect) =>
    setPlacements((p) => ({ ...p, [page]: { rect } }));
  const onRemove = (page: number) =>
    setPlacements((p) => {
      const next = { ...p };
      delete next[page];
      return next;
    });

  const run = async () => {
    if (!pdfFile || !sig) return;
    const pages = Object.keys(placements).map(Number);
    if (pages.length === 0) {
      setError("Click a page to place your signature first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let out = pdfFile.bytes;
      for (const pageNumber of pages) {
        const info = pageInfo[pageNumber - 1];
        const p = placements[pageNumber];
        const scale = PAGE_W / info.width;
        const displayHeight = info.height * scale;
        const xPts = p.rect.left / scale;
        const widthPts = p.rect.width / scale;
        const yPts = (displayHeight - p.rect.top - p.rect.height) / scale;
        out = await embedSignature(out, pageNumber, sig, { xPts, yPts, widthPts });
      }
      setResult({ bytes: out, name: `${baseName(pdfFile.name)}-signed.pdf`, size: out.byteLength });
    } catch (err) {
      console.error("Sign PDF failed", err);
      const detail = err instanceof Error && err.message ? ` ${err.message}` : "";
      setError(`We couldn't sign that PDF. Please try a different PDF.${detail}`);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <ResultCard
        message="Your PDF is signed."
        filename={result.name}
        sizeLabel={formatBytes(result.size)}
        onDownload={() => downloadBlob(bytesToBlob(result.bytes, "application/pdf"), result.name)}
        onReset={reset}
      />
    );
  }

  const overlayUrl = sig?.dataUrl ?? null;
  const overlayAspect = sig ? sig.width / sig.height : 1;

  return (
    <div>
      <DropZone
        accept="application/pdf,.pdf"
        label="Drop a PDF here, or click to browse"
        hint="Then draw or type your signature and place it on a page"
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
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-foreground">Your signature</h2>
            <div className="mt-4 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Segmented
                  label="Method"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "draw", label: "Draw" },
                    { value: "type", label: "Type your name" },
                  ]}
                />
                <Field label="Ink color">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-11 w-full cursor-pointer rounded-lg border border-border bg-white p-1"
                  />
                </Field>
              </div>
              {mode === "draw" ? (
                <SignaturePad color={color} onChange={applySignature} />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Field label="Your name">
                      <input
                        type="text"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-2 focus:outline-ring"
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={() => void renderTyped()}
                    disabled={busy}
                    className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    Render signature
                  </button>
                </div>
              )}
            </div>
          </div>

          {sig && (
            <>
              <p className="text-sm text-foreground/70">
                <span className="font-semibold text-foreground">{pdfFile.name}</span> ·{" "}
                {pageCount} page{pageCount === 1 ? "" : "s"} — click a page to place your
                signature, then drag or resize it.
              </p>
              <div className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <PlacementPage
                    key={n}
                    doc={doc}
                    pageNumber={n}
                    displayWidth={PAGE_W}
                    overlayUrl={overlayUrl}
                    overlayAspect={overlayAspect}
                    placement={placements[n]?.rect ?? null}
                    isActive={activePage === n}
                    onSelect={setActivePage}
                    onPlace={onPlace}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    showHint={activePage === n && !placements[n]}
                  />
                ))}
              </div>
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => void run()}
                  disabled={busy || Object.keys(placements).length === 0}
                  className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  Sign PDF
                </button>
                {Object.keys(placements).length === 0 && (
                  <p className="text-sm text-foreground/60">Place your signature on at least one page.</p>
                )}
                {busy && <Spinner label="Signing your PDF…" />}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
