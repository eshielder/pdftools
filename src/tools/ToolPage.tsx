import type { ComponentType } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ToolShell from "./components/ToolShell";
import { toolBySlug } from "../data/tools";
import MergeTool from "./MergeTool";
import SplitTool from "./SplitTool";
import ImageToPdfTool from "./ImageToPdfTool";
import PdfToImageTool from "./PdfToImageTool";
import SignTool from "./SignTool";
import InsertImageTool from "./InsertImageTool";
import ProtectTool from "./ProtectTool";
import OptimizeTool from "./OptimizeTool";

const toolComponents: Record<string, ComponentType> = {
  merge: MergeTool,
  split: SplitTool,
  "image-to-pdf": ImageToPdfTool,
  "pdf-to-image": PdfToImageTool,
  sign: SignTool,
  "insert-image": InsertImageTool,
  protect: ProtectTool,
  "web-optimize": OptimizeTool,
};

export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = slug ? toolBySlug(slug) : undefined;

  if (!tool) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <p className="text-lg font-medium text-foreground">We couldn't find that tool.</p>
        <Link
          to="/"
          className="press inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary transition-colors hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to all tools
        </Link>
      </div>
    );
  }

  const Component = slug ? toolComponents[slug] : undefined;

  return (
    <ToolShell tool={tool}>
      {Component ? (
        <Component />
      ) : (
        <p className="text-center text-foreground/70">This tool isn't available yet.</p>
      )}
    </ToolShell>
  );
}
