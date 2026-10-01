import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

// Static server with SPA fallback so /tool/:slug resolves to index.html.
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
      fs.readFile(path.join(root, "index.html"), (err2, html) => {
        if (err2) {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        res.writeHead(200, { "content-type": "text/html" });
        res.end(html);
      });
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

await new Promise((r) => server.listen(4783, r));
console.log("serving dist on 4783");

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-software-rasterizer"],
});
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

let failures = 0;
const check = (cond, msg) => {
  console.log((cond ? "PASS" : "FAIL") + ": " + msg);
  if (!cond) failures++;
};

await page.goto("http://127.0.0.1:4783/", { waitUntil: "load" });
await page.waitForSelector("h1", { timeout: 15000 });

// 1. Hero heading
const h1 = (await page.textContent("h1")) || "";
check(h1.includes("Every PDF tool"), `hero heading present: "${h1.trim()}"`);

// 2. Card count === 7 (no Protect PDF)
const cards = await page.locator("a[href^='/tool/']").count();
check(cards === 7, `expected 7 tool cards, got ${cards}`);

// 3. No "Protect" anywhere on the landing page
const bodyText = await page.textContent("body");
check(!/protect/i.test(bodyText), "no 'Protect' text on landing page");

// 4. All expected tools present
const expected = ["Merge PDF", "Split PDF", "Image to PDF", "PDF to Image", "Sign PDF", "Insert Image", "Optimize PDF"];
for (const t of expected) {
  check(bodyText.includes(t), `card present: ${t}`);
}

// 5. Click a card -> client-side navigation to /tool/:slug
await page.click("a[href='/tool/merge']");
await page.waitForURL("**/tool/merge", { timeout: 5000 }).catch(() => {});
check(page.url().includes("/tool/merge"), `navigated to /tool/merge: ${page.url()}`);
const toolH1 = (await page.textContent("h1")) || "";
check(toolH1.includes("Merge PDF"), `tool page heading: "${toolH1.trim()}"`);
check(((await page.textContent("body")) || "").includes("on its way"), "tool placeholder page rendered");

// 6. Back to landing, then no page errors / failed requests / error boundary
await page.goto("http://127.0.0.1:4783/", { waitUntil: "load" });
await page.waitForSelector("h1", { timeout: 15000 });

const errs = logs.filter(
  (l) => l.startsWith("[pageerror]") || l.startsWith("[error]") || l.startsWith("[requestfailed]")
);
check(errs.length === 0, `no page errors / console errors / failed requests (${errs.length})`);
if (errs.length) console.log("--- errors ---\n" + errs.join("\n"));

console.log(failures === 0 ? "SMOKE PASS" : `SMOKE FAIL (${failures})`);
await browser.close();
server.close();
process.exit(failures === 0 ? 0 : 1);
