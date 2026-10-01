import type { ReactNode } from "react";
import { CheckCircle2, Download, RotateCcw } from "lucide-react";

interface ResultCardProps {
  message: string;
  filename: string;
  sizeLabel?: string;
  downloadLabel?: string;
  onDownload: () => void;
  onReset: () => void;
  children?: ReactNode;
}

/** Success state shown after a tool produces output: check + download + reset. */
export default function ResultCard({
  message,
  filename,
  sizeLabel,
  downloadLabel = "Download",
  onDownload,
  onReset,
  children,
}: ResultCardProps) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="animate-pop-in flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">{message}</h2>
          <p className="mt-1 text-sm text-foreground/60">
            {filename}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onDownload}
            className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary transition-colors hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {downloadLabel}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="press inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Start over
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
