import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(".scratch-dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".css": "text/css",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

await new Promise((r) => server.listen(4783, r));
console.log("serving on 4783");

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-software-rasterizer"],
});
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

await page.goto("http://127.0.0.1:4783/", { waitUntil: "load" });
await page
  .waitForFunction(() => window.__pdfjsResult && window.__qpdfResult, { timeout: 60000 })
  .catch(() => {});

console.log("PDFJS:", await page.evaluate(() => window.__pdfjsResult || "not set"));
console.log("QPDF:", await page.evaluate(() => window.__qpdfResult || "not set"));
console.log("--- console ---");
console.log(logs.join("\n"));
await browser.close();
server.close();
