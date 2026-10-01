import { PDFDocument, degrees } from "pdf-lib";
import type { PDFImage, PDFPage } from "pdf-lib";

export interface PreparedImage {
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export async function mergePdfs(buffers: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  return merged.save();
}

export async function splitPdf(
  buffer: Uint8Array,
  ranges: Array<[number, number]>
): Promise<Array<{ bytes: Uint8Array; pages: number }>> {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const total = src.getPageCount();
  const out: Array<{ bytes: Uint8Array; pages: number }> = [];
  for (const [a, b] of ranges) {
    const start = Math.max(0, a - 1);
    const end = Math.min(total, b);
    const indices: number[] = [];
    for (let i = start; i < end; i += 1) indices.push(i);
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(src, indices);
    for (const p of pages) doc.addPage(p);
    out.push({ bytes: await doc.save(), pages: end - start });
  }
  return out;
}

export type ImagePdfOptions = {
  pageSize: "auto" | "A4" | "Letter";
  orientation: "portrait" | "landscape";
  margin: number;
  layout: "one-per-page" | "stacked";
};

const PAGE_SIZES: Record<"A4" | "Letter", [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
};

export async function imagesToPdf(images: PreparedImage[], opts: ImagePdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  if (opts.layout === "stacked") {
    await addStackedPage(doc, images, opts);
  } else {
    for (const img of images) {
      const embedded = await embedImage(doc, img);
      const [pw, ph] = pageSizeFor(opts, img.width, img.height);
      const page = doc.addPage([pw, ph]);
      drawImageCentered(page, embedded, pw, ph, opts.margin);
    }
  }
  return doc.save();
}

async function addStackedPage(doc: PDFDocument, images: PreparedImage[], opts: ImagePdfOptions) {
  const gap = 8;
  const items: Array<{ img: PDFImage; w: number; h: number }> = [];
  let maxW = 0;
  let totalH = 0;
  for (const img of images) {
    const embedded = await embedImage(doc, img);
    items.push({ img: embedded, w: embedded.width, h: embedded.height });
    maxW = Math.max(maxW, embedded.width);
    totalH += embedded.height;
  }
  totalH += (items.length - 1) * gap;
  const pw = maxW + opts.margin * 2;
  const ph = totalH + opts.margin * 2;
  const page = doc.addPage([pw, ph]);
  let y = ph - opts.margin;
  for (const item of items) {
    page.drawImage(item.img, { x: (pw - item.w) / 2, y: y - item.h, width: item.w, height: item.h });
    y -= item.h + gap;
  }
}

function pageSizeFor(opts: ImagePdfOptions, w: number, h: number): [number, number] {
  let pw: number;
  let ph: number;
  if (opts.pageSize === "auto") {
    pw = w;
    ph = h;
  } else {
    [pw, ph] = PAGE_SIZES[opts.pageSize];
  }
  if (opts.orientation === "landscape" && ph > pw) return [ph, pw];
  if (opts.orientation === "portrait" && pw > ph) return [ph, pw];
  return [pw, ph];
}

function drawImageCentered(page: PDFPage, img: PDFImage, pw: number, ph: number, margin: number) {
  const availW = Math.max(1, pw - margin * 2);
  const availH = Math.max(1, ph - margin * 2);
  const scale = Math.min(availW / img.width, availH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
}

async function embedImage(doc: PDFDocument, img: PreparedImage): Promise<PDFImage> {
  if (img.mime === "image/jpeg") return doc.embedJpg(img.bytes);
  return doc.embedPng(img.bytes);
}

/** Strips unused objects and recompresses internal streams for a smaller file. */
export async function optimizePdf(buffer: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  return doc.save({ useObjectStreams: true });
}

export interface PdfPlacement {
  /** Left edge of the *displayed* (post-rotation) box, in PDF points. */
  xPts: number;
  /** Bottom edge of the *displayed* (post-rotation) box, in PDF points. */
  yPts: number;
  /** Width of the *displayed* (post-rotation) box, in PDF points. */
  widthPts: number;
  /** Height of the *displayed* (post-rotation) box, in PDF points. */
  heightPts?: number;
}

export async function embedSignature(
  buffer: Uint8Array,
  pageNumber: number,
  sig: { bytes: Uint8Array; width: number; height: number },
  placement: PdfPlacement
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const page = doc.getPage(pageNumber - 1);
  const img = await doc.embedPng(sig.bytes);
  const heightPts = (sig.height / sig.width) * placement.widthPts;
  page.drawImage(img, {
    x: placement.xPts,
    y: placement.yPts,
    width: placement.widthPts,
    height: heightPts,
  });
  return doc.save();
}

export async function insertImageIntoPdf(
  buffer: Uint8Array,
  pageNumber: number,
  img: PreparedImage,
  placement: PdfPlacement,
  rotationDeg: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const page = doc.getPage(pageNumber - 1);
  const embedded = await embedImage(doc, img);

  // `placement` describes the box the user sees (already rotated). pdf-lib
  // rotates the drawn rect around its own center, so compute the unrotated
  // draw rect from the displayed box before calling drawImage.
  const dw = placement.widthPts;
  const dh = placement.heightPts ?? (img.height / img.width) * dw;
  const rot = ((rotationDeg % 360) + 360) % 360;
  const swapped = rot % 180 === 90;
  const drawW = swapped ? dh : dw;
  const drawH = swapped ? dw : dh;
  const cx = placement.xPts + dw / 2;
  const cy = placement.yPts + dh / 2;

  page.drawImage(embedded, {
    x: cx - drawW / 2,
    y: cy - drawH / 2,
    width: drawW,
    height: drawH,
    // Canvas (used for the preview) treats positive angles as clockwise, while
    // PDF treats them as counter-clockwise. Negate so the output matches the
    // preview the user saw.
    rotate: degrees((360 - rot) % 360),
  });
  return doc.save();
}


