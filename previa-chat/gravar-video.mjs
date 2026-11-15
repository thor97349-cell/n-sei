// Grava adultando-previa-chat.html em MP4 (H.264, sem áudio, 1080x1350, 30fps, loop perfeito).
//
// Uso:   node previa-chat/gravar-video.mjs [entrada.html] [saida.mp4] [crf]
// Precisa de: Playwright (com Chromium) e ffmpeg instalados.
//
// A animação é uma função do tempo (window.PREVIEW.renderAt), então cada quadro é
// renderizado exatamente no instante certo: o vídeo sai liso e idêntico toda vez,
// e o último quadro emenda no primeiro.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { statSync } from "node:fs";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(require.resolve("playwright", { paths: [process.cwd(), "/usr/lib/node_modules", "/usr/local/lib/node_modules"] })); }

const here = dirname(fileURLToPath(import.meta.url));
const input = resolve(process.argv[2] || resolve(here, "adultando-previa-chat.html"));
const output = resolve(process.argv[3] || resolve(here, "adultando-previa-chat.mp4"));
const crf = process.argv[4] || "20";

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(input).href + "?record=1");
await page.evaluate(async () => {
  await Promise.all(["600 10px Outfit", "700 10px Outfit", "400 10px Inter", "500 10px Inter", "600 10px Inter"].map((f) => document.fonts.load(f)));
  await document.fonts.ready;
});
const { frames, fps, duration } = await page.evaluate(() => window.PREVIEW);
const overflow = await page.evaluate(() => window.PREVIEW.fits());
overflow.forEach((px, i) => { if (px > 0) console.warn(`⚠ Conversa ${i + 1}: resposta passa ${px}px da janela (vai rolar). Encurte o texto.`); });
console.log(`Gravando ${frames} quadros (${duration.toFixed(2)}s a ${fps}fps) → ${output}`);

const ff = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
  "-an", "-c:v", "libx264", "-preset", "veryslow", "-tune", "animation", "-crf", crf,
  "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0", "-r", String(fps),
  "-g", String(fps * 4), "-movflags", "+faststart", output,
], { stdio: ["pipe", "inherit", "inherit"] });
const ffDone = new Promise((ok, fail) => ff.on("close", (c) => (c === 0 ? ok() : fail(new Error("ffmpeg saiu com " + c)))));

for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => window.PREVIEW.renderAt(t), f / fps);
  const png = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 150 === 0) process.stdout.write(`  ${f}/${frames}\n`);
}
ff.stdin.end();
await ffDone;
await browser.close();
console.log(`Pronto: ${output} (${(statSync(output).size / 1024 / 1024).toFixed(2)} MB)`);
