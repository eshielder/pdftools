import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export type { PDFDocumentProxy } from "pdfjs-dist";

export async function loadPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  // pdfjs-dist transfers the passed ArrayBuffer to its worker (see getDocument →
  // sendWithPromise("GetDocRequest", docParams, [data.buffer])), which *detaches*
  // the buffer in the main thread. Copy the bytes first so callers keep a valid
  // buffer for later processing (e.g. stamping/signing with pdf-lib) — otherwise
  // the original reads back as an empty array and pdf-lib fails with
  // "No PDF header found".
  return pdfjsLib.getDocument({ data: data.slice() }).promise;
}

export interface RenderedPage {
  pageWidth: number;
  pageHeight: number;
  displayWidth: number;
  displayHeight: number;
  scale: number;
}

/**
 * Renders a PDF page into the given canvas, fitted to displayWidth CSS px.
 * Pass an AbortSignal to cancel an in-flight render (the caller should abort the
 * previous signal before starting a new render on the same canvas).
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  target: HTMLCanvasElement,
  displayWidth: number,
  signal?: AbortSignal
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (displayWidth / base.width) * dpr;
  const scaled = page.getViewport({ scale });

  const result: RenderedPage = {
    pageWidth: base.width,
    pageHeight: base.height,
    displayWidth: Math.floor(displayWidth),
    displayHeight: Math.floor((displayWidth * base.height) / base.width),
    scale: Math.floor(displayWidth) / base.width,
  };

  // A re-render may have superseded this one while we were awaiting getPage().
  if (signal?.aborted) return result;

  target.width = Math.floor(scaled.width);
  target.height = Math.floor(scaled.height);
  target.style.width = `${result.displayWidth}px`;
  target.style.height = `${result.displayHeight}px`;

  const ctx = target.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Could not create a canvas context.");

  const task = page.render({ canvasContext: ctx, viewport: scaled });
  const cancel = () => task.cancel();
  if (signal) {
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
  }

  try {
    await task.promise;
  } catch (err) {
    if (signal?.aborted) return result; // cancelled on purpose
    throw err;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }

  return result;
}

export interface PageImageOptions {
  format: "png" | "jpeg";
  quality: number;
  scale: number;
}

export async function pageToImageBlob(
  doc: PDFDocumentProxy,
  pageNumber: number,
  opts: PageImageOptions
): Promise<Blob> {
  const page = await doc.getPage(pageNumber);
  const scaled = page.getViewport({ scale: opts.scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(scaled.width);
  canvas.height = Math.floor(scaled.height);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Could not create a canvas context.");
  await page.render({ canvasContext: ctx, viewport: scaled }).promise;

  if (opts.format === "png") {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed."))), "image/png");
    });
  }

  // JPEG has no alpha channel — composite onto a white background.
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const fctx = flat.getContext("2d");
  if (!fctx) throw new Error("Could not create a canvas context.");
  fctx.fillStyle = "#ffffff";
  fctx.fillRect(0, 0, flat.width, flat.height);
  fctx.drawImage(canvas, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    flat.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG export failed."))),
      "image/jpeg",
      opts.quality
    );
  });
}
