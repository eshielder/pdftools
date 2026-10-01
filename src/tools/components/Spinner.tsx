export default function Spinner({ label = "Working…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
      <span
        className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
        aria-hidden="true"
      />
      <span className="text-sm font-medium text-foreground/70">{label}</span>
    </div>
  );
}
