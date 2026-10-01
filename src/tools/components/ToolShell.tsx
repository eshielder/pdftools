import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import TopBar from "../../components/TopBar";
import type { ToolMeta } from "../../data/tools";

interface ToolShellProps {
  tool: ToolMeta;
  children: ReactNode;
}

/** Shared layout for every tool page: top bar, header, body, privacy footer. */
export default function ToolShell({ tool, children }: ToolShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <header className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <tool.icon className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {tool.title}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-foreground/70 sm:text-lg">
            {tool.description}
          </p>
        </header>
        <div className="mt-8">{children}</div>
      </main>
      <footer className="border-t border-border bg-white/60 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-1.5 px-4 text-center text-sm font-medium text-foreground/70">
          <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
          100% private — files never leave your device
        </div>
      </footer>
    </div>
  );
}
