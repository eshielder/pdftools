import { defineConfig } from "vite";

// Temporary config to smoke-test qpdf-wasm + pdfjs-dist in a real browser.
// This file and the scratch/ folder are deleted after verification.
export default defineConfig({
  root: "scratch",
  base: "./",
  build: {
    outDir: "../.scratch-dist",
    assetsInlineLimit: 0,
  },
});
