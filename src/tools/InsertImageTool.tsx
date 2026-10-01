import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Crosshair } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf } from "../lib/pdfjs";
import { fileToUint8, isPdfFile, prepareImage } from "../lib/image";
import type { PreparedImage } from "../lib/pdf";
import { insertImageIntoPdf } from "../lib/pdf";
import { bytesToBlob, downloadBlob } from "../lib/download";
import { baseName, formatBytes } from "../lib/format";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import Spinner from "./components/Spinner";
import PlacementPage, { type PlacementRect } from "./components/PlacementPage";
import { Segmented } from "./components/Controls";

const MAX_VIEWER_W = 720;
const IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";

type Rotation = "0" | "90" | "180" | "270";

interface PdfState {
  name: string;
  size: number;
  bytes: Uint8Array;
}

interface PageInfo {
  width: number;
  height: number;
}

interface Overlay {
  url: string;
  width: number;
  height: number;
}

/**
 * Placements are stored as fractions of the page (0..1) so they stay correct
 * when the viewer resizes between placement and export.
 */
const displayHeightFor = (info: PageInfo, width: number) =>
  Math.floor((width * info.height) / info.width);

const toDisplayRect = (
  n: PlacementRect | null,
  info: PageInfo,
  width: number
): PlacementRect | null => {
  if (!n) return null;
  const dh = displayHeightFor(info, width);
  return {
    left: n.left * width,
    top: n.top * dh,
    width: n.width * width,
    height: n.height * dh,
  };
};

const toNormalRect = (r: PlacementRect, info: PageInfo, width: number): PlacementRect => {
  const dh = displayHeightFor(info, width);
  return {
    left: r.left / width,
    top: r.top / dh,
    width: r.width / width,
    height: r.height / dh,
  };
};

export default function InsertImageTool() {
  const [pdfFile, setPdfFile] = useState<PdfState | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageInfo, setPageInfo] = useState<PageInfo[]>([]);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageName, setImageName] = useState("");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [rotation, setRotation] = useState<Rotation>("0");
  const [placements, setPlacements] = useState<Record<number, { rect: PlacementRect }>>({});
  const [activePage, setActivePage] = useState(1);
  const [placeMode, setPlaceMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; name: string; size: number } | null>(null);

  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewerWidth, setViewerWidth] = useState(560);

  useEffect(() => {
    if (!image) {
      setOverlay(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const blob = bytesToBlob(image.bytes, image.mime);
        const bitmap = await createImageBitmap(blob);
        if (cancelled) {
          bitmap.close();
          return;
        }
        const rot = ((Number(rotation) % 360) + 360) % 360;
        const swap = rot === 90 || rot === 270;
        const w = swap ? bitmap.height : bitmap.width;
        const h = swap ? bitmap.width : bitmap.height;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          bitmap.close();
          throw new Error("Could not preview this image.");
        }
        ctx.translate(w / 2, h / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
        bitmap.close();
        setOverlay({ url: canvas.toDataURL("image/png"), width: w, height: h });
      } catch (err) {
        if (!cancelled) {
          console.error("Image preview failed", err);
          setError("We couldn't preview that image. Try a different file.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [image, rotation]);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setViewerWidth(Math.max(280, Math.min(MAX_VIEWER_W, Math.floor(w))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlay]);

  const reset = () => {
    if (doc) void doc.destroy();
    setDoc(null);
    setPdfFile(null);
    setPageCount(0);
    setPageInfo([]);
    setImage(null);
    setImageName("");
    setOverlay(null);
    setRotation("0");
    setPlacements({});
    setActivePage(1);
    setPlaceMode(true);
    setResult(null);
    setError(null);
  };

  const addPdf = (incoming: File[]) => {
    setError(null);
    setLoadingPdf(true);
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
          setLoadingPdf(false);
          return;
        }

        const bytes = await fileToUint8(file);
        const loaded = await loadPdf(bytes);
        if (doc) void doc.destroy();
        const info: PageInfo[] = [];
        for (let i = 1; i <= loaded.numPages; i += 1) {
          const page = await loaded.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          info.push({ width: vp.width, height: vp.height });
        }
        setPdfFile({ name: file.name || "document.pdf", size: bytes.byteLength, bytes });
        setDoc(loaded);
        setPageCount(loaded.numPages);
        setPageInfo(info);
        setPlacements({});
        setActivePage(1);
        setResult(null);
      } catch (err) {
        console.error("InsertImageTool load error", err);
        setError("We couldn't read that PDF. It may be corrupt or password-protected.");
      } finally {
        setLoadingPdf(false);
      }
    })();
  };

  const addImage = (incoming: File[]) => {
    const file = incoming[0];
    if (!file) return;
    setError(null);
    setLoadingImage(true);
    void (async () => {
      try {
        const prepared = await prepareImage(file);
        setImage(prepared);
        setImageName(file.name || "image");
        setPlacements({});
        setPlaceMode(true);
      } catch (e) {
        console.error("InsertImageTool image error", e);
        setError(e instanceof Error && e.message ? e.message : "We couldn't read that image.");
      } finally {
        setLoadingImage(false);
      }
    })();
  };

  const changeRotation = (r: Rotation) => {
    setRotation(r);
    setPlacements({});
  };

  const onPlace = (page: number, rect: PlacementRect) => {
    const info = pageInfo[page - 1];
    if (!info) return;
    setPlacements((p) => ({ ...p, [page]: { rect: toNormalRect(rect, info, viewerWidth) } }));
  };
  const onUpdate = (page: number, rect: PlacementRect) => {
    const info = pageInfo[page - 1];
    if (!info) return;
    setPlacements((p) => ({ ...p, [page]: { rect: toNormalRect(rect, info, viewerWidth) } }));
  };
  const onRemove = (page: number) =>
    setPlacements((p) => {
      const next = { ...p };
      delete next[page];
      return next;
    });

  const run = async () => {
    if (!pdfFile || !image || !overlay) return;
    const pages = Object.keys(placements).map(Number);
    if (pages.length === 0) {
      setError("Click the page to place the image first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let out = pdfFile.bytes;
      for (const pageNumber of pages) {
        const info = pageInfo[pageNumber - 1];
        const p = placements[pageNumber];
        if (!info || !p) continue;
        const xPts = p.rect.left * info.width;
        const widthPts = p.rect.width * info.width;
        const heightPts = p.rect.height * info.height;
        const yPts = (1 - p.rect.top - p.rect.height) * info.height;
        out = await insertImageIntoPdf(
          out,
          pageNumber,
          image,
          { xPts, yPts, widthPts, heightPts },
          Number(rotation)
        );
      }
      setResult({ bytes: out, name: `${baseName(pdfFile.name)}-stamped.pdf`, size: out.byteLength });
    } catch (err) {
      console.error("Insert image failed", err);
      const detail = err instanceof Error && err.message ? ` ${err.message}` : "";
      setError(`We couldn't insert that image into the PDF. Please try a different image or PDF.${detail}`);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <ResultCard
        message="Your image was inserted."
        filename={result.name}
        sizeLabel={formatBytes(result.size)}
        onDownload={() => downloadBlob(bytesToBlob(result.bytes, "application/pdf"), result.name)}
        onReset={reset}
      />
    );
  }

  const activeInfo = pageInfo[activePage - 1];
  const displayRect = activeInfo
    ? toDisplayRect(placements[activePage]?.rect ?? null, activeInfo, viewerWidth)
    : null;

  return (
    <div className="space-y-6">
      {!pdfFile ? (
        <>
          <DropZone
            accept="application/pdf,application/x-pdf,.pdf"
            label="Drop a PDF here, or click to browse"
            hint="The document you want to stamp an image onto"
            onFiles={addPdf}
            disabled={loadingPdf}
          />
          {loadingPdf && <Spinner label="Opening your PDF…" />}
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
          <p className="min-w-0 truncate text-sm text-foreground/70">
            <span className="font-semibold text-foreground">{pdfFile.name}</span> ·{" "}
            {pageCount} page{pageCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={reset}
            className="press cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          >
            Change PDF
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {pdfFile && !image && (
        <>
          <DropZone
            accept={IMAGE_ACCEPT}
            label="Drop an image here, or click to browse"
            hint="JPG, PNG or WebP — this is what you'll stamp onto the PDF"
            onFiles={addImage}
            disabled={loadingImage}
          />
          {loadingImage && <Spinner label="Preparing your image…" />}
        </>
      )}

      {pdfFile && doc && image && overlay && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{imageName}</p>
                <p className="text-xs text-foreground/60">
                  Turn on Insert image, then click anywhere on the page to place it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setImageName("");
                  setOverlay(null);
                  setPlacements({});
                  setPlaceMode(true);
                }}
                className="press cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              >
                Change image
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <Segmented
                label="Rotation"
                value={rotation}
                onChange={changeRotation}
                options={[
                  { value: "0", label: "0°" },
                  { value: "90", label: "90°" },
                  { value: "180", label: "180°" },
                  { value: "270", label: "270°" },
                ]}
              />
              <div className="flex justify-center">
                <img
                  src={overlay.url}
                  alt=""
                  className="max-h-24 rounded-lg border border-border object-contain"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{pdfFile.name}</p>
                <p className="text-xs text-foreground/60">
                  Place it, then drag, resize or rotate to fine-tune.
                </p>
              </div>
              <button
                type="button"
                aria-pressed={placeMode}
                onClick={() => setPlaceMode((v) => !v)}
                className={`press inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  placeMode
                    ? "bg-primary text-on-primary hover:opacity-90"
                    : "border border-border bg-white text-foreground hover:bg-muted"
                }`}
              >
                <Crosshair className="h-4 w-4" aria-hidden="true" />
                Insert image
              </button>
            </div>

            <div ref={viewerRef} className="mt-5 flex justify-center">
              <PlacementPage
                doc={doc}
                pageNumber={activePage}
                displayWidth={viewerWidth}
                overlayUrl={overlay.url}
                overlayAspect={overlay.width / overlay.height}
                placement={displayRect}
                isActive
                onSelect={setActivePage}
                onPlace={onPlace}
                onUpdate={onUpdate}
                onRemove={onRemove}
                showHint={placeMode}
                placeMode={placeMode}
                replaceOnPlace={placeMode}
              />
            </div>

            <nav aria-label="PDF page navigation" className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="Previous page"
                disabled={activePage === 1}
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                className="press flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <span aria-current="page" className="text-sm font-semibold text-foreground">
                Page {activePage} of {pageCount}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={activePage === pageCount}
                onClick={() => setActivePage((p) => Math.min(pageCount, p + 1))}
                className="press flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void run()}
              disabled={busy || Object.keys(placements).length === 0}
              className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Apply to PDF
            </button>
            {Object.keys(placements).length === 0 && (
              <p className="text-sm text-foreground/60">Place the image on at least one page.</p>
            )}
            {busy && <Spinner label="Inserting image…" />}
          </div>
        </div>
      )}
    </div>
  );
}
