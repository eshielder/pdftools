import type { PreparedImage } from "./pdf";

const MAX_CANVAS_DIM = 4096;

/** Reads an image file, normalizes WebP/HEIC/etc. to PNG or JPEG, and prevents mobile GPU crashes. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let sourceWidth = 0;
  let sourceHeight = 0;
  let drawSource: (ctx: CanvasRenderingContext2D, dw: number, dh: number) => void;
  let cleanup: () => void = () => {};

  try {
    const bitmap = await createImageBitmap(file);
    sourceWidth = bitmap.width;
    sourceHeight = bitmap.height;
    drawSource = (ctx, dw, dh) => ctx.drawImage(bitmap, 0, 0, dw, dh);
    cleanup = () => bitmap.close();
  } catch {
    // Fallback for mobile browsers or formats where createImageBitmap fails
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const imageEl = new Image();
        imageEl.onload = () => resolve(imageEl);
        imageEl.onerror = () =>
          reject(new Error(`"${file.name || "image"}" isn't a readable image file.`));
        imageEl.src = objectUrl;
      });
      sourceWidth = img.naturalWidth || img.width;
      sourceHeight = img.naturalHeight || img.height;
      drawSource = (ctx, dw, dh) => ctx.drawImage(img, 0, 0, dw, dh);
      cleanup = () => URL.revokeObjectURL(objectUrl);
    } catch (fallbackErr) {
      URL.revokeObjectURL(objectUrl);
      throw fallbackErr;
    }
  }

  // Cap dimensions to MAX_CANVAS_DIM to avoid crashing mobile browsers with large camera photos
  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;
  if (targetWidth > MAX_CANVAS_DIM || targetHeight > MAX_CANVAS_DIM) {
    const scale = Math.min(MAX_CANVAS_DIM / targetWidth, MAX_CANVAS_DIM / targetHeight);
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }

  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const asJpeg = mime === "image/jpeg" || mime === "image/jpg" || /\.jpe?g$/i.test(name);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cleanup();
    throw new Error("Could not process this image on this device.");
  }

  if (asJpeg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  drawSource(ctx, targetWidth, targetHeight);
  cleanup();

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
    width: targetWidth,
    height: targetHeight,
  };
}

/** Reads a File into Uint8Array with fallback for mobile browsers / virtual content URIs. */
export async function fileToUint8(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    try {
      const buf = await file.arrayBuffer();
      return new Uint8Array(buf);
    } catch (err) {
      console.warn("file.arrayBuffer() failed on mobile device, trying FileReader fallback", err);
    }
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error(`Failed to read "${file.name || "document"}" as binary data.`));
      }
    };
    reader.onerror = () => {
      reject(
        new Error(
          `Could not read file "${file.name || "document"}". If this file is stored in cloud storage or an external app, please download it to device storage and try again.`
        )
      );
    };
    reader.readAsArrayBuffer(file);
  });
}

/** Fast synchronous check by MIME type or extension. */
export function looksLikePdf(file: File): boolean {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return true;
  const mime = (file.type || "").toLowerCase();
  return (
    mime === "application/pdf" ||
    mime === "application/x-pdf" ||
    mime === "application/acrobat" ||
    mime === "applications/vnd.pdf" ||
    mime === "text/pdf"
  );
}

/**
 * Validates if a file is a PDF. On Android, files from Downloads, WhatsApp,
 * or cloud storage often have empty MIME type or generic "application/octet-stream"
 * and temporary filenames without extension. This function checks magic bytes as fallback.
 */
export async function isPdfFile(file: File): Promise<boolean> {
  if (!file) return false;
  if (looksLikePdf(file)) return true;

  try {
    const slice = file.slice(0, 1024);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i <= bytes.length - 5; i++) {
      if (
        bytes[i] === 0x25 && // %
        bytes[i + 1] === 0x50 && // P
        bytes[i + 2] === 0x44 && // D
        bytes[i + 3] === 0x46 && // F
        bytes[i + 4] === 0x2d // -
      ) {
        return true;
      }
    }
  } catch {
    // If slice fails, cannot verify magic bytes
  }

  return false;
}

/** Fast synchronous check for images. */
export function looksLikeImage(file: File): boolean {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|heic|heif|svg)$/i.test(name)) return true;
  const mime = (file.type || "").toLowerCase();
  return mime.startsWith("image/");
}

/** Validates if a file is an image, with magic bytes fallback for Android mobile. */
export async function isImageFile(file: File): Promise<boolean> {
  if (!file) return false;
  if (looksLikeImage(file)) return true;

  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true; // JPEG
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true; // PNG
    if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true; // WEBP (RIFF)
    if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true; // GIF
    if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return true; // BMP
  } catch {
    // ignore
  }

  return false;
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
