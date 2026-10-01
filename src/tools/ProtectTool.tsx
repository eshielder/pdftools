import { useCallback, useState } from "react";
import { Lock } from "lucide-react";
import { protectPdf } from "../lib/protect";
import { fileToUint8, isPdfFile } from "../lib/image";
import { downloadBlob, bytesToBlob } from "../lib/download";
import { baseName, formatBytes } from "../lib/format";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import Spinner from "./components/Spinner";
import { Checkbox, Field } from "./components/Controls";

export default function ProtectTool() {
  const [fileName, setFileName] = useState("");
  const [buffer, setBuffer] = useState<Uint8Array | null>(null);
  const [userPassword, setUserPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [restrictPrinting, setRestrictPrinting] = useState(false);
  const [restrictCopying, setRestrictCopying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; name: string; size: number } | null>(null);

  const addFile = useCallback((incoming: File[]) => {
    setError(null);
    setResult(null);
    void (async () => {
      let file: File | undefined;
      for (const f of incoming) {
        if (await isPdfFile(f)) {
          file = f;
          break;
        }
      }
      if (!file) {
        setError("That doesn't look like a PDF. Please choose a .pdf file.");
        return;
      }
      setBusy(true);
      try {
        const bytes = await fileToUint8(file);
        setFileName(file.name || "document.pdf");
        setBuffer(bytes);
      } catch (err) {
        console.error("ProtectTool load error", err);
        setError("We couldn't read that file. Please try again.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const reset = () => {
    setBuffer(null);
    setFileName("");
    setResult(null);
    setError(null);
    setUserPassword("");
    setConfirmPassword("");
    setOwnerPassword("");
  };

  const validate = (): string | null => {
    if (!userPassword) return "Enter a password to protect the PDF.";
    if (userPassword.length < 4) return "Use at least 4 characters for the password.";
    if (userPassword !== confirmPassword) return "The passwords don't match. Please re-enter them.";
    if (userPassword === ownerPassword && userPassword !== "") {
      return "The owner password must be different from the user password.";
    }
    return null;
  };

  const runProtect = async () => {
    if (!buffer) return;
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    try {
      const out = await protectPdf(buffer, {
        userPassword,
        ownerPassword: ownerPassword || undefined,
        restrictPrinting,
        restrictCopying,
      });
      setResult({
        bytes: out,
        name: `${baseName(fileName) || "protected"}-protected.pdf`,
        size: out.byteLength,
      });
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? `We couldn't protect that PDF: ${e.message}`
          : "We couldn't protect that PDF. It may already be encrypted."
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
        message="Your PDF is now password protected."
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
        accept="application/pdf,application/x-pdf,.pdf"
        label="Drop a PDF here, or click to browse"
        hint="Choose the file you want to lock with a password"
        onFiles={addFile}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {buffer && (
        <div className="mt-6 space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="truncate text-sm font-semibold text-foreground">{fileName}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password (required)" hint="Required to open the document">
              <input
                type="password"
                value={userPassword}
                autoComplete="new-password"
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder="Enter a password"
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat the password"
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </Field>
          </div>

          <Field label="Owner password (optional)" hint="Manage permissions with this password. Defaults to the user password if left blank.">
            <input
              type="password"
              value={ownerPassword}
              autoComplete="new-password"
              onChange={(e) => setOwnerPassword(e.target.value)}
              placeholder="Password for managing permissions"
              className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox
              label="Restrict printing"
              description="Others can open the file but not print it"
              checked={restrictPrinting}
              onChange={setRestrictPrinting}
            />
            <Checkbox
              label="Restrict copying"
              description="Prevent text and images from being copied out"
              checked={restrictCopying}
              onChange={setRestrictCopying}
            />
          </div>

          <div className="flex flex-col items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void runProtect()}
              disabled={busy}
              className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Protect PDF
            </button>
            {busy && <Spinner label="Encrypting your PDF…" />}
          </div>
        </div>
      )}
    </div>
  );
}
