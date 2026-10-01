import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { X } from "lucide-react";
import { renderPage } from "../../lib/pdfjs";

export interface PlacementRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PlacementPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number; // 1-based
  displayWidth: number; // CSS px
  overlayUrl: string | null; // data URL of the image to place (already rotated)
  overlayAspect: number; // width / height of the overlay as displayed
  placement: PlacementRect | null;
  isActive: boolean;
  onSelect: (pageNumber: number) => void;
  onPlace: (pageNumber: number, rect: PlacementRect) => void;
  onUpdate: (pageNumber: number, rect: PlacementRect) => void;
  onRemove: (pageNumber: number) => void;
  showHint?: boolean;
  /** When false, clicking the page only selects it (no placement). Defaults to true. */
  placeMode?: boolean;
  /** When true, clicking empty space re-places even if a placement already exists. */
  replaceOnPlace?: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * A single page preview with an optional draggable/resizable overlay image.
 * Used by the Sign PDF and Insert Image tools. Click empty space to place the
 * overlay; drag it to move; drag the corner handle to resize.
 */
export default function PlacementPage({
  doc,
  pageNumber,
  displayWidth,
  overlayUrl,
  overlayAspect,
  placement,
  isActive,
  onSelect,
  onPlace,
  onUpdate,
  onRemove,
  showHint = false,
  placeMode = true,
  replaceOnPlace = false,
}: PlacementPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    orig: PlacementRect;
    cw: number;
    ch: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return;
    const controller = new AbortController();
    renderPage(doc, pageNumber, canvas, displayWidth, controller.signal).catch((err: unknown) => {
      if (!controller.signal.aborted) console.error("Page preview render failed", err);
    });
    return () => controller.abort();
  }, [doc, pageNumber, displayWidth]);

  const canvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { cw: displayWidth, ch: displayWidth };
    const r = canvas.getBoundingClientRect();
    return { cw: r.width, ch: r.height };
  };

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!overlayUrl) return;
    if (!placeMode) {
      onSelect(pageNumber);
      return;
    }
    if (placement && !replaceOnPlace) {
      onSelect(pageNumber);
      return;
    }
    const { cw, ch } = canvasSize();
    const x = e.clientX - canvasRef.current!.getBoundingClientRect().left;
    const y = e.clientY - canvasRef.current!.getBoundingClientRect().top;
    const w = clamp(Math.min(cw * 0.5, 160), 32, cw);
    const h = w / overlayAspect;
    onPlace(pageNumber, {
      left: clamp(x - w / 2, 0, cw - w),
      top: clamp(y - h / 2, 0, ch - h),
      width: w,
      height: h,
    });
    onSelect(pageNumber);
  };

  const startDrag = (e: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") => {
    if (!placement || !overlayUrl) return;
    if (!isActive) {
      onSelect(pageNumber);
      return;
    }
    const { cw, ch } = canvasSize();
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...placement },
      cw,
      ch,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const doDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const s = dragRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.mode === "move") {
      onUpdate(pageNumber, {
        left: clamp(s.orig.left + dx, 0, s.cw - s.orig.width),
        top: clamp(s.orig.top + dy, 0, s.ch - s.orig.height),
        width: s.orig.width,
        height: s.orig.height,
      });
    } else {
      let w = clamp(s.orig.width + dx, 28, s.cw - s.orig.left);
      let h = w / overlayAspect;
      if (s.orig.top + h > s.ch) {
        h = Math.max(28, s.ch - s.orig.top);
        w = h * overlayAspect;
      }
      onUpdate(pageNumber, {
        left: s.orig.left,
        top: s.orig.top,
        width: w,
        height: h,
      });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border transition-shadow duration-150 ${
        isActive ? "border-primary ring-2 ring-primary/40" : "border-border"
      }`}
      style={{ width: displayWidth }}
    >
      <canvas
        ref={canvasRef}
        className={`block touch-none ${placeMode && overlayUrl ? "cursor-crosshair" : ""}`}
        style={{ touchAction: "none" }}
        onPointerDown={onCanvasPointerDown}
      />
      {showHint && !placement && (
        <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
          Click to place
        </span>
      )}
      {overlayUrl && placement && (
        <div
          className={`absolute select-none ${
            isActive ? "ring-2 ring-primary/80" : "ring-1 ring-primary/40"
          }`}
          style={{
            left: placement.left,
            top: placement.top,
            width: placement.width,
            height: placement.height,
            cursor: isActive ? "move" : "pointer",
            touchAction: "none",
          }}
          onPointerDown={(e) => startDrag(e, "move")}
          onPointerMove={doDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            src={overlayUrl}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full select-none"
          />
          {isActive && (
            <>
              <button
                type="button"
                aria-label={`Remove signature from page ${pageNumber}`}
                title="Remove"
                className="press absolute -right-2 -top-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-destructive text-white shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(pageNumber);
                }}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
              <span
                role="presentation"
                className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm bg-primary shadow ring-2 ring-white"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  startDrag(e, "resize");
                }}
                onPointerMove={doDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
