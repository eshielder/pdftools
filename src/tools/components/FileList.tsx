import { ArrowDown, ArrowUp, FileText, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatBytes } from "../../lib/format";

export interface FileListItem {
  id: string;
  name: string;
  size: number;
  thumb?: string;
}

interface FileListProps {
  items: FileListItem[];
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}

function IconButton({
  label,
  onClick,
  icon: Icon,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="press flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/** Reorderable, keyboard-accessible file list with up/down + remove controls. */
export default function FileList({ items, onMove, onRemove }: FileListProps) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-4 space-y-2">
      {items.map((item, i) => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-sm"
        >
          {item.thumb ? (
            <img
              src={item.thumb}
              alt=""
              className="h-11 w-11 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
            <p className="text-xs text-foreground/60">
              {formatBytes(item.size)}
              {items.length > 1 && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/60">
                  Position {i + 1} of {items.length}
                </span>
              )}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1">
            <IconButton
              label={`Move ${item.name} up`}
              disabled={i === 0}
              onClick={() => onMove(item.id, -1)}
              icon={ArrowUp}
            />
            <IconButton
              label={`Move ${item.name} down`}
              disabled={i === items.length - 1}
              onClick={() => onMove(item.id, 1)}
              icon={ArrowDown}
            />
            <IconButton label={`Remove ${item.name}`} onClick={() => onRemove(item.id)} icon={Trash2} />
          </span>
        </li>
      ))}
    </ul>
  );
}
