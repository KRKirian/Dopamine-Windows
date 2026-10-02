// Renders the macOS installer background at 1x and 2x.
//
//   cd site/tools && npm install && npm run dmg-background
//
// Needs Google Chrome (or set CHROME_PATH). Reads DopamineMac/Resources/dmg/background.html and
// writes background.png and background@2x.png next to it; dmgbuild merges them into one HiDPI TIFF.

import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const DMG_DIR = resolve(fileURLToPath(new URL("../../DopamineMac/Resources/dmg", import.meta.url)));
const SOURCE = pathToFileURL(join(DMG_DIR, "background.html")).href;
const SIZE = { width: 660, height: 400 };
const OUTPUTS = [
  { scale: 1, file: "background.png" },
  { scale: 2, file: "background@2x.png" },
];
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({ executablePath: CHROME });
try {
  for (const { scale, file } of OUTPUTS) {
    const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: scale });
    await page.goto(SOURCE, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const path = join(DMG_DIR, file);
    await page.screenshot({ path, clip: { x: 0, y: 0, ...SIZE } });
    await page.close();
    console.log(`✓ ${path}`);
  }
} finally {
  await browser.close();
}
