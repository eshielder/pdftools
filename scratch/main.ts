import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

declare global {
  interface Window {
    __pdfjsResult?: string;
    __pdfjsVersion?: string;
  }
}

const log = (m: string) => {
  const el = document.getElementById("log")!;
  el.innerHTML += `<div>${m}</div>`;
};

async function makePdfBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const p = doc.addPage([300, 300]);
  p.drawText("hello smoke test", { x: 40, y: 140, size: 20 });
  return doc.save();
}

async function testPdfjs() {
  window.__pdfjsVersion = (pdfjs as unknown as { version?: string }).version || "?";
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = await makePdfBytes();
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
  const msg = `PDFJS OK: v${window.__pdfjsVersion} rendered ${canvas.width}x${canvas.height}`;
  window.__pdfjsResult = msg;
  log(msg);
  await doc.destroy();
}

window.addEventListener("load", async () => {
  try {
    await testPdfjs();
  } catch (e) {
    const msg = `PDFJS FAIL: ${e}`;
    window.__pdfjsResult = msg;
    log(msg);
  }
});
