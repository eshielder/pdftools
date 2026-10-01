import type { PreparedImage } from "./pdf";

/** Reads an image file and normalizes WebP (or any other format) to PNG. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`"${file.name}" isn't a readable image file.`);
  }

  const { width, height } = bitmap;
  const mime = file.type.toLowerCase();
  const asJpeg = mime === "image/jpeg" || mime === "image/jpg";

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process this image.");
  }

  // Always re-encode through the browser's decoder instead of handing the
  // original bytes to pdf-lib. pdf-lib only supports a subset of JPEG/PNG
  // variants and does not apply EXIF orientation, so a photo that previews
  // fine can otherwise fail — or come out rotated/stretched — when embedded.
  if (asJpeg) {
    // JPEG has no alpha channel: flatten onto white to avoid black edges.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not convert this image."))),
      asJpeg ? "image/jpeg" : "image/png",
      asJpeg ? 0.95 : undefined
    );
  });

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mime: asJpeg ? "image/jpeg" : "image/png",
    width,
    height,
  };
}

export async function fileToUint8(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/** Converts a canvas to PNG data URL + raw bytes + dimensions. */
export async function canvasToPngData(canvas: HTMLCanvasElement): Promise<{
  dataUrl: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}> {
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not export the signature."))),
      "image/png"
    );
  });
  return {
    dataUrl,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
  };
}

/** Returns a tightly cropped copy of the canvas, or null if it is blank. */
export function trimTransparentCanvas(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = source.getContext("2d");
  if (!ctx) return null;
  const w = source.width;
  const h = source.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = bw;
  out.height = bh;
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.drawImage(source, minX, minY, bw, bh, 0, 0, bw, bh);
  return out;
}

/** Renders a typed name as a signature image using a cursive font. */
export async function renderTypedSignature(
  text: string,
  color: string
): Promise<HTMLCanvasElement> {
  const font = "700 110px Caveat, cursive";
  await document.fonts.load(font);

  const measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) throw new Error("Could not render the typed signature.");
  measureCtx.font = font;
  const width = Math.ceil(measureCtx.measureText(text).width) + 24;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 150;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not render the typed signature.");
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 12, 118);
  return canvas;
}
