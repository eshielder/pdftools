import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { UploadCloud } from "lucide-react";

interface DropZoneProps {
  accept: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Click-to-browse + drag-and-drop file input. The native input is visually
 * hidden; the whole button opens the picker and accepts drops, so it is fully
 * keyboard accessible (Tab + Enter/Space) and touch friendly.
 */
export default function DropZone({
  accept,
  multiple = false,
  label,
  hint,
  onFiles,
  disabled = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`press flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-200 ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-white hover:border-primary/60 hover:bg-primary/5"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="font-semibold text-foreground">{label}</span>
        {hint && <span className="text-sm text-foreground/60">{hint}</span>}
      </button>
    </div>
  );
}
