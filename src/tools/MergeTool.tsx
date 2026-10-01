import { useCallback, useState } from "react";
import { Merge } from "lucide-react";
import { mergePdfs } from "../lib/pdf";
import { fileToUint8, isPdfFile } from "../lib/image";
import { downloadBlob, bytesToBlob } from "../lib/download";
import { formatBytes } from "../lib/format";
import DropZone from "./components/DropZone";
import FileList from "./components/FileList";
import ResultCard from "./components/ResultCard";
import Spinner from "./components/Spinner";

interface MergeFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
}

let uid = 0;
const nextId = () => `merge-${++uid}`;

export default function MergeTool() {
  const [files, setFiles] = useState<MergeFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; name: string; size: number } | null>(null);

  const addFiles = useCallback((incoming: File[]) => {
    setError(null);
    const valid = incoming.filter(isPdfFile);
    if (valid.length !== incoming.length) {
      setError("Only PDF files can be merged. Non-PDF files were skipped.");
    }
    if (valid.length === 0) return;
    void Promise.all(
      valid.map(async (f): Promise<MergeFile> => {
        const bytes = await fileToUint8(f);
        return { id: nextId(), name: f.name, size: bytes.byteLength, bytes };
      })
    ).then((loaded) => setFiles((prev) => [...prev, ...loaded]));
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

  const runMerge = async () => {
    if (files.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const out = await mergePdfs(files.map((f) => f.bytes));
      setResult({ bytes: out, name: "merged.pdf", size: out.byteLength });
    } catch {
      setError("We couldn't merge those files. Make sure they're valid PDFs and try again.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    downloadBlob(bytesToBlob(result.bytes, "application/pdf"), result.name);
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
  };

  if (result) {
    return (
      <ResultCard
        message="Your PDFs were merged."
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
        accept="application/pdf,.pdf"
        multiple
        label="Drop PDF files here, or click to browse"
        hint="Select two or more PDFs to combine them into one document"
        onFiles={addFiles}
        disabled={busy}
      />
      <FileList
        items={files.map(({ id, name, size }) => ({ id, name, size }))}
        onMove={move}
        onRemove={remove}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => void runMerge()}
          disabled={files.length < 2 || busy}
          className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Merge className="h-4 w-4" aria-hidden="true" />
          Merge {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "PDFs"}
        </button>
        {files.length > 0 && files.length < 2 && (
          <p className="text-sm text-foreground/60">Add at least one more PDF to merge.</p>
        )}
        {busy && <Spinner label="Merging your PDFs…" />}
      </div>
    </div>
  );
}
