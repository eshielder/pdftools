import JSZip from "jszip";

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Convert a Uint8Array into a Blob, copying the bytes so the underlying buffer always matches the view. */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = bytes.slice();
  return new Blob([copy.buffer as ArrayBuffer], { type });
}

export async function downloadZip(
  files: Array<{ name: string; blob: Blob }>,
  zipName: string
): Promise<void> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  downloadBlob(blob, zipName.endsWith(".zip") ? zipName : `${zipName}.zip`);
}
