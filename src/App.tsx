import { useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import TopBar from "./components/TopBar";
import Login from "./components/Login";
import ToolPage from "./tools/ToolPage";
import { tools, type ToolMeta } from "./data/tools";
import { getSession, type Session } from "./lib/auth";

function ToolCard({ slug, title, description, icon: Icon }: ToolMeta) {
  return (
    <Link
      to={`/tool/${slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-on-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">
        {description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        Open tool
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {/* Hero */}
        <section className="pt-16 pb-12 text-center sm:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            All in your browser
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl font-heading text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Every PDF tool you need, right in your browser
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-foreground/70">
            Merge, split, sign, and convert PDFs — all processed locally on
            your device. Nothing is ever uploaded.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            100% private — files never leave your device
          </span>
        </section>

        {/* Tool grid */}
        <section aria-label="PDF tools" className="pt-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.slug} {...tool} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center sm:px-6">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
            <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
            100% private — files never leave your device
          </p>
          <p className="text-xs text-foreground/60">
            PDF Toolbox · Everything runs locally in your browser.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => getSession());

  if (!session) {
    return <Login onSignIn={setSession} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/tool/:slug" element={<ToolPage />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}
