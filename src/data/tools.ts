import {
  FileImage,
  Gauge,
  ImageDown,
  ImagePlus,
  Lock,
  Merge,
  PenLine,
  Scissors,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ToolMeta {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const tools: ToolMeta[] = [
  {
    slug: "merge",
    title: "Merge PDF",
    description: "Combine multiple PDFs into one document, in any order.",
    icon: Merge,
  },
  {
    slug: "split",
    title: "Split PDF",
    description: "Extract specific pages or split into chunks of N pages.",
    icon: Scissors,
  },
  {
    slug: "image-to-pdf",
    title: "Image to PDF",
    description: "Turn JPG, PNG or WebP images into a single PDF.",
    icon: FileImage,
  },
  {
    slug: "pdf-to-image",
    title: "PDF to Image",
    description: "Convert PDF pages into PNG or JPG images.",
    icon: ImageDown,
  },
  {
    slug: "sign",
    title: "Sign PDF",
    description: "Draw a signature and place it on any page.",
    icon: PenLine,
  },
  {
    slug: "insert-image",
    title: "Insert Image",
    description: "Stamp an image onto a page of your PDF.",
    icon: ImagePlus,
  },
  {
    slug: "protect",
    title: "Protect PDF",
    description: "Lock your PDF with a password and control who can print or copy.",
    icon: Lock,
  },
  {
    slug: "web-optimize",
    title: "Optimize PDF",
    description: "Shrink file size for faster downloads and web delivery.",
    icon: Gauge,
  },
];

export function toolBySlug(slug: string): ToolMeta | undefined {
  return tools.find((t) => t.slug === slug);
}
