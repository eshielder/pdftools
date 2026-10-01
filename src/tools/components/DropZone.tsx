import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
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
 * Click-to-browse + drag-and-drop file input optimized for desktop and mobile.
 * Uses a native <label> pattern so Android Chrome/Samsung Internet can trigger
 * the system file picker directly without programmatic .click() restrictions.
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

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input value so selecting the same file again triggers onChange
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <label
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`press flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-200 select-none ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-border bg-white hover:border-primary/60 hover:bg-primary/5"
      } ${disabled ? "pointer-events-none opacity-60 cursor-not-allowed" : ""} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        className="sr-only"
        onChange={handleChange}
        onClick={(e) => {
          // Ensure file input value is cleared before picker opens on Android
          (e.target as HTMLInputElement).value = "";
        }}
      />
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UploadCloud className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="font-semibold text-foreground">{label}</span>
      {hint && <span className="text-sm text-foreground/60">{hint}</span>}
    </label>
  );
}
