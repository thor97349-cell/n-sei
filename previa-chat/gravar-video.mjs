// Grava as prévias HTML em MP4 (H.264, sem áudio, 1080x1350, 30fps, loop perfeito, até ~5 MB).
//
// Uso:   node previa-chat/gravar-video.mjs                 (grava os dois: normal e cinematográfico)
//        node previa-chat/gravar-video.mjs entrada.html    (grava só esse; o MP4 sai com o mesmo nome)
// Precisa de: Playwright (com Chromium) e ffmpeg instalados.
//
// A animação é uma função do tempo (window.PREVIEW.renderAt), então cada quadro é
// renderizado exatamente no instante certo: o vídeo sai liso e idêntico toda vez,
// e o último quadro emenda no primeiro.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(require.resolve("playwright", { paths: [process.cwd(), "/usr/lib/node_modules", "/usr/local/lib/node_modules"] })); }

const LIMITE_MB = 4.8;
const here = dirname(fileURLToPath(import.meta.url));
const entradas = process.argv.length > 2
  ? process.argv.slice(2).map((f) => resolve(f))
  : ["adultando-chat.html", "adultando-chat-cinematico.html"].map((f) => resolve(here, f));

const run = (args) => new Promise((ok, fail) => {
  const p = spawn("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "inherit", "inherit"] });
  p.on("close", (c) => (c === 0 ? ok() : fail(new Error("ffmpeg saiu com " + c))));
});
const mb = (f) => statSync(f).size / 1024 / 1024;
const H264 = ["-an", "-c:v", "libx264", "-preset", "veryslow", "-tune", "animation", "-pix_fmt", "yuv420p",
  "-profile:v", "high", "-level", "4.0", "-g", "120", "-movflags", "+faststart"];

const browser = await playwright.chromium.launch();
for (const input of entradas) {
  const output = input.replace(/\.html$/, ".mp4");
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(input).href + "?record=1");
  await page.evaluate(async () => {
    await Promise.all(["400 10px Inter", "500 10px Inter", "600 10px Inter"].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    window.PREVIEW.reset();
  });
  const { frames, fps, duration } = await page.evaluate(() => window.PREVIEW);
  const overflow = await page.evaluate(() => window.PREVIEW.fits());
  overflow.forEach((px, i) => { if (px > 150) console.warn(`⚠ Conversa ${i + 1}: passa ${px}px da janela (o chat rola, mas o começo some). Vale encurtar o texto.`); });
  console.log(`Gravando ${frames} quadros (${duration.toFixed(2)}s) → ${output}`);

  // 1) quadros → arquivo intermediário sem perdas
  const tmp = mkdtempSync(resolve(tmpdir(), "previa-"));
  const master = resolve(tmp, "master.mkv");
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "ultrafast", "-qp", "0", master], { stdio: ["pipe", "inherit", "inherit"] });
  const ffDone = new Promise((ok, fail) => ff.on("close", (c) => (c === 0 ? ok() : fail(new Error("ffmpeg saiu com " + c)))));
  await page.evaluate(() => window.PREVIEW.reset());
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.PREVIEW.renderAt(t), f / fps);
    const png = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 300 === 0) console.log(`  ${f}/${frames}`);
  }
  ff.stdin.end();
  await ffDone;
  await page.close();

  // 2) MP4 final: qualidade alta; se passar do limite, 2 passadas com bitrate calculado
  await run(["-i", master, ...H264, "-crf", "20", "-r", String(fps), output]);
  if (mb(output) > LIMITE_MB) {
    const kbps = Math.floor((LIMITE_MB * 8 * 1024 * 0.97) / duration);
    const log = resolve(tmp, "pass");
    await run(["-i", master, ...H264, "-b:v", kbps + "k", "-pass", "1", "-passlogfile", log, "-f", "mp4", "/dev/null"]);
    await run(["-i", master, ...H264, "-b:v", kbps + "k", "-pass", "2", "-passlogfile", log, output]);
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(`Pronto: ${output} (${mb(output).toFixed(2)} MB)`);
}
await browser.close();
