import { useCallback, useEffect, useState } from "react";
import { FileImage } from "lucide-react";
import { imagesToPdf } from "../lib/pdf";
import { isImageFile, prepareImage } from "../lib/image";
import { downloadBlob, bytesToBlob } from "../lib/download";
import { baseName, formatBytes } from "../lib/format";
import DropZone from "./components/DropZone";
import FileList from "./components/FileList";
import ResultCard from "./components/ResultCard";
import Spinner from "./components/Spinner";
import { Field, Segmented } from "./components/Controls";

interface ImageFile {
  id: string;
  name: string;
  size: number;
  file: File;
}

let uid = 0;
const nextId = () => `img-${++uid}`;

const IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";

export default function ImageToPdfTool() {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState<"auto" | "A4" | "Letter">("auto");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margin, setMargin] = useState(24);
  const [layout, setLayout] = useState<"one-per-page" | "stacked">("one-per-page");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; name: string; size: number } | null>(null);

  useEffect(() => {
    const urls: Record<string, string> = {};
    for (const f of files) urls[f.id] = URL.createObjectURL(f.file);
    setThumbs(urls);
    return () => {
      for (const url of Object.values(urls)) URL.revokeObjectURL(url);
    };
  }, [files]);

  const addFiles = useCallback((incoming: File[]) => {
    setError(null);
    setResult(null);
    void (async () => {
      try {
        const checks = await Promise.all(
          incoming.map(async (f) => ({ file: f, valid: await isImageFile(f) }))
        );
        const valid = checks.filter((c) => c.valid).map((c) => c.file);
        if (valid.length !== incoming.length && valid.length > 0) {
          setError("Some files weren't recognized images and were skipped. Supported: JPG, PNG and WebP.");
        } else if (valid.length === 0 && incoming.length > 0) {
          setError("None of the selected files could be recognized as images. Supported: JPG, PNG and WebP.");
          return;
        }
        if (valid.length === 0) return;
        setFiles((prev) => [
          ...prev,
          ...valid.map((file) => ({ id: nextId(), name: file.name || "image", size: file.size, file })),
        ]);
      } catch (err) {
        console.error("ImageToPdfTool load error", err);
        setError("Could not process one or more images on this device.");
      }
    })();
  }, []);

  const move = useCallback((id: string, dir: -1 | 1) => {
    setFiles((prev) => {
      const i = prev.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => setFiles((prev) => prev.filter((f) => f.id !== id)), []);

  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
  };

  const runConvert = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = [];
      for (const f of files) prepared.push(await prepareImage(f.file));
      const out = await imagesToPdf(prepared, { pageSize, orientation, margin, layout });
      const name = files.length === 1 ? `${baseName(files[0].name)}.pdf` : "images.pdf";
      setResult({ bytes: out, name, size: out.byteLength });
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "We couldn't convert those images. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    downloadBlob(bytesToBlob(result.bytes, "application/pdf"), result.name);
  };

  if (result) {
    return (
      <ResultCard
        message="Your images were converted to PDF."
        filename={result.name}
        sizeLabel={formatBytes(result.size)}
        onDownload={download}
        onReset={reset}
      />
    );
  }

  return (
    <div>
      <DropZone
        accept={IMAGE_ACCEPT}
        multiple
        label="Drop images here, or click to browse"
        hint="JPG, PNG or WebP — you can reorder them before converting"
        onFiles={addFiles}
        disabled={busy}
      />
      <FileList
        items={files.map(({ id, name, size }) => ({ id, name, size, thumb: thumbs[id] }))}
        onMove={move}
        onRemove={remove}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <div className="mt-6 space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2">
            <Segmented
              label="Page size"
              value={pageSize}
              onChange={setPageSize}
              options={[
                { value: "auto", label: "Auto" },
                { value: "A4", label: "A4" },
                { value: "Letter", label: "Letter" },
              ]}
            />
            <Segmented
              label="Orientation"
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: "portrait", label: "Portrait" },
                { value: "landscape", label: "Landscape" },
              ]}
            />
            <Segmented
              label="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: "one-per-page", label: "One per page" },
                { value: "stacked", label: "Stack on one page" },
              ]}
            />
            <Field label={`Margin: ${margin} pt`}>
              <input
                type="range"
                min={0}
                max={72}
                step={2}
                value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value, 10))}
                className="w-full accent-[var(--color-primary)]"
              />
            </Field>
          </div>

          <div className="flex flex-col items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void runConvert()}
              disabled={busy}
              className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileImage className="h-4 w-4" aria-hidden="true" />
              Convert to PDF
            </button>
            {busy && <Spinner label="Building your PDF…" />}
          </div>
        </div>
      )}
    </div>
  );
}
