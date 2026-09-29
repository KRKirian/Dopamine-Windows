// Renders the tour film frame by frame and encodes it as MP4.
//
//   cd site/tools && npm install && npm run record            # every language
//   npm run record -- --lang en --fps 30 --scale 1.5
//
// Needs Google Chrome (or set CHROME_PATH). Each frame is rendered by the page's own
// render(t), so the video matches what plays on the site exactly.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import { chromium } from "playwright-core";

const SITE = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT_DIR = join(SITE, "media");
const LANGS = ["en", "zh-CN", "zh-TW"];
const FILE_FOR = { en: "dopamine-tour.mp4", "zh-CN": "dopamine-tour.zh-CN.mp4", "zh-TW": "dopamine-tour.zh-TW.mp4" };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" };
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function parseArgs(argv) {
  const args = { langs: LANGS, fps: 30, scale: 1.5 };
  for (let i = 0; i < argv.length; i += 2) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (key === "--lang") args.langs = [value];
    else if (key === "--fps") args.fps = Number(value);
    else if (key === "--scale") args.scale = Number(value);
    else throw new Error(`Unknown option ${key}`);
  }
  if (!args.langs.every((l) => LANGS.includes(l))) throw new Error(`--lang must be one of ${LANGS.join(", ")}`);
  if (!(args.fps > 0 && args.scale > 0)) throw new Error("--fps and --scale must be positive numbers");
  return args;
}

/** Serves the site folder on a free local port. */
function serveSite() {
  const server = createServer(async (req, res) => {
    try {
      const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
      let file = join(SITE, path);
      if (!file.startsWith(SITE)) throw new Error("outside site");
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

function startEncoder(file, fps) {
  const ff = spawn(
    ffmpegPath,
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
      "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((ok, fail) => {
    ff.on("error", fail);
    ff.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited with ${code}`))));
  });
  // If ffmpeg dies mid-film, writes fail with EPIPE; `done` reports why.
  ff.stdin.on("error", () => {});
  return { stdin: ff.stdin, done };
}

async function recordOne(browser, base, lang, { fps, scale }) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
  await page.goto(`${base}/?record=1&lang=${lang}`);
  await page.waitForFunction(() => window.__film && document.fonts.status === "loaded");
  const duration = await page.evaluate(() => window.__film.duration);
  const frames = Math.round(duration * fps);
  const file = join(OUT_DIR, FILE_FOR[lang]);
  const encoder = startEncoder(file, fps);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.__film.render(t), i / fps);
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1280, height: 720 } });
    if (!encoder.stdin.write(png)) await new Promise((ok) => encoder.stdin.once("drain", ok));
    if (i % fps === 0) process.stdout.write(`\r${lang}: ${Math.round((i / frames) * 100)}%`);
  }
  encoder.stdin.end();
  await encoder.done;
  await page.close();
  const { size } = await stat(file);
  process.stdout.write(`\r${lang}: ${file} (${(size / 1e6).toFixed(1)} MB)\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });
  const server = await serveSite();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    for (const lang of args.langs) await recordOne(browser, base, lang, args);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  process.stderr.write(`\nRecording failed: ${err.message}\n`);
  process.exit(1);
});
