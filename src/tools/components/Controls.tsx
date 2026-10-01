import type { ReactNode } from "react";

/** Wrapper that labels a control and optionally adds helper text. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-foreground/60">{hint}</span>}
    </label>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Accessible segmented control (radio group rendered as buttons). */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-semibold text-foreground">{label}</legend>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted p-1"
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={`press cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                selected
                  ? "bg-white text-primary shadow-sm"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Accessible styled checkbox. */
export function Checkbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-3 transition-colors hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
      />
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-foreground/60">{description}</span>
        )}
      </span>
    </label>
  );
}
