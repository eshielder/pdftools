import { Link } from "react-router-dom";
import { FileStack, LogOut, ShieldCheck } from "lucide-react";
import { getSession, signOut } from "../lib/auth";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md"
          aria-label="PDF Toolbox home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
            <FileStack className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">
            PDF Toolbox
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            100% private
          </span>
          {(() => {
            const session = getSession();
            if (!session) return null;
            return (
              <button
                type="button"
                onClick={() => {
                  signOut();
                  window.location.assign("/");
                }}
                title={`Signed in as ${session.email}`}
                className="press inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-muted"
              >
                <span className="hidden max-w-[8rem] truncate sm:inline">{session.name}</span>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Log out</span>
              </button>
            );
          })()}
        </div>
      </div>
    </header>
  );
}
