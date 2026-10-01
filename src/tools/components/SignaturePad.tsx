import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Eraser } from "lucide-react";
import { canvasToPngData, trimTransparentCanvas } from "../../lib/image";

export interface SignatureData {
  dataUrl: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

interface SignaturePadProps {
  color: string;
  onChange: (sig: SignatureData | null) => void;
}

const PAD_WIDTH = 720;
const PAD_HEIGHT = 260;

/**
 * Drawable signature pad (mouse + touch). The ink is drawn on a fixed-size
 * canvas and scaled to fit; on each stroke end the drawing is trimmed and
 * reported to the parent as PNG bytes + a data URL.
 */
export default function SignaturePad({ color, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const getPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAD_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * PAD_HEIGHT,
    };
  };

  const exportInk = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const trimmed = trimTransparentCanvas(canvas);
    if (!trimmed) {
      onChange(null);
      return;
    }
    void canvasToPngData(trimmed).then((d) =>
      onChange({ dataUrl: d.dataUrl, bytes: d.bytes, width: d.width, height: d.height })
    );
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = getPos(e);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const last = lastRef.current;
    if (!ctx || !last) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
    setHasInk(true);
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    exportInk();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={PAD_WIDTH}
          height={PAD_HEIGHT}
          aria-label="Signature drawing pad. Draw with your mouse, finger or stylus."
          role="img"
          className="h-40 w-full cursor-crosshair touch-none rounded-xl border border-border bg-white shadow-inner"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-foreground/40">
            Draw your signature here
          </span>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="press inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Eraser className="h-4 w-4" aria-hidden="true" />
          Clear
        </button>
      </div>
    </div>
  );
}
