import { useState } from "react";
import type { FormEvent } from "react";
import { FileStack, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { signIn, type Session } from "../lib/auth";

export default function Login({ onSignIn }: { onSignIn: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter an email and password, or use demo login.");
      return;
    }
    onSignIn(signIn(email.trim()));
  };

  const demoLogin = () => {
    setEmail("demo@example.com");
    setPassword("demo1234");
    onSignIn(signIn("demo@example.com"));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-white p-8 shadow-sm sm:p-10">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
              <FileStack className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="mt-5 font-heading text-2xl font-bold tracking-tight text-foreground">
              Sign in to PDF Toolbox
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              All tools run in your browser. Use demo login to get started instantly.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-2 focus:outline-ring"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-2 focus:outline-ring"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="press inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary transition-colors hover:opacity-90"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-foreground/40">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            or
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>

          <button
            type="button"
            onClick={demoLogin}
            className="press inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            Demo login
          </button>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-sm font-medium text-foreground/60">
          <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
          100% private — files never leave your device
        </p>
      </div>
    </div>
  );
}
