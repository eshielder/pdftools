# PDF Toolbox

A modern, fast, and 100% private in-browser PDF manipulation suite built with React, Vite, Tailwind CSS, `pdf-lib`, and `pdfjs-dist`.

All document processing happens completely client-side in your browser. **No files are ever uploaded to any server.**

---

## Features

- **Merge PDF**: Combine multiple PDFs into a single document with drag-and-drop reordering.
- **Split PDF**: Extract specific page ranges (e.g. `1-3, 5, 7-9`) or split into chunks of *N* pages.
- **Image to PDF**: Convert JPG, PNG, and WebP images into a PDF with configurable page sizes (A4, Letter, Auto), margins, and layouts (stacked or 1-per-page).
- **PDF to Image**: Render PDF pages into high-resolution PNG or JPG images with custom DPI settings (72, 150, 300 DPI) and ZIP export.
- **Sign PDF**: Draw a signature or generate a cursive signature and interactively place, move, and resize it on any page.
- **Insert Image**: Stamp logos, seals, or images onto PDF pages with real-time interactive positioning, scaling, and rotation.
- **Protect PDF**: Secure PDFs with AES-256 password protection and customizable printing/copying permission restrictions.
- **Optimize PDF**: Streamline and recompress PDF object streams to reduce file size.

---

## Tech Stack

- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 7](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with OKLCH color tokens
- **PDF Engine**:
  - [`pdf-lib`](https://pdf-lib.js.org/) for PDF composition and manipulation
  - [`pdfjs-dist`](https://mozilla.github.io/pdf.js/) for high-fidelity client-side PDF rendering
  - [`@pdfsmaller/pdf-encrypt`](https://github.com/pdfsmaller/pdf-encrypt) for AES-256 Web Crypto encryption
  - [`jszip`](https://stuk.github.io/jszip/) for multi-file downloads
- **Icons**: [Lucide React](https://lucide.dev/)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### Installation

```bash
git clone https://github.com/eshielder/pdftools.git
cd pdftools
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
```

The output will be generated in the `dist/` directory, ready to be hosted as a static site on any provider (Vercel, Netlify, GitHub Pages, Cloudflare Pages, etc.).

---

## Privacy & Security

PDF Toolbox was built with privacy as the core philosophy. All operations run locally on the client machine via WebAssembly and Web Crypto API. No analytics, tracking, or remote endpoints are included.

---

## License

MIT
