// Teste de ponta a ponta do editor no navegador (Chromium de verdade, via Playwright).
//
// Pré-requisitos (não fazem parte das dependências do site):
//   npm i --no-save playwright-core@1.56.1        # ou outra versão compatível com seu Chromium
//   site rodando:   npx next build && npx next start -p 3000
//   (o ffmpeg.wasm vem do próprio site; CORE=url só serve para testar outra cópia, com CORS)
// Uso:
//   CHROMIUM=/caminho/chrome VIDEO=video.mp4 LONG_VIDEO=video_90s.mp4 MUSIC=musica.mp3 OUT=pasta \
//   SITE=http://localhost:3000 node tests/editor/e2e-browser.mjs
// Cada cenário imprime OK/FALHOU; os MP4 baixados ficam em OUT para conferência com ffprobe.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const { chromium } = await import("playwright-core");
// LONG_VIDEO: vídeo mais longo (ex.: 90 s) para dar tempo de clicar em Cancelar no meio.
const { CHROMIUM, VIDEO, LONG_VIDEO, MUSIC, OUT = ".", SITE = "http://localhost:3000", CORE = "" } = process.env;
const url = `${SITE}/editor${CORE ? `?core=${encodeURIComponent(CORE)}` : ""}`;
const TIMEOUT = 15 * 60 * 1000;
let failures = 0;
const ok = (msg) => console.log(`  [OK]     ${msg}`);
const fail = (msg) => { failures++; console.log(`  [FALHOU] ${msg}`); };

const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
await page.goto(url);

async function waitDone() {
  await page.waitForFunction(() => !document.getElementById("result").hidden
    || document.querySelector("#msgs li.error, #msgs li.warn:last-child")?.textContent.includes("cancelada")
    || document.querySelector("#msgs li.error"), null, { timeout: TIMEOUT });
}

async function saveResult(name) {
  const b64 = await page.evaluate(async () => {
    const buf = new Uint8Array(await (await fetch(document.getElementById("download").href)).arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  return file;
}

// Passa o arquivo pelo conteúdo (o Playwright falha com caminhos acentuados), mantendo o nome original.
const asUpload = (file, mimeType) => ({ name: path.basename(file), mimeType, buffer: fs.readFileSync(file) });

// Confere o MP4 baixado com o ffprobe do sistema: H.264 + AAC, tamanho e duração esperados.
function checkMP4(file, [w, h], duration) {
  const data = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
  const v = data.streams.find((s) => s.codec_type === "video");
  const a = data.streams.find((s) => s.codec_type === "audio");
  const got = Number(data.format.duration);
  if (v?.codec_name === "h264" && a?.codec_name === "aac" && v.width === w && v.height === h && Math.abs(got - duration) < 0.4) {
    ok(`MP4 válido: H.264 ${v.width}×${v.height} + AAC, ${got.toFixed(2)} s`);
  } else {
    fail(`MP4 inesperado: ${v?.codec_name} ${v?.width}×${v?.height}, áudio ${a?.codec_name}, ${got} s (esperado ${w}×${h}, ~${duration} s)`);
  }
}

const messages = () => page.$$eval("#msgs li", (els) => els.map((e) => `${e.className}: ${e.textContent}`));

console.log(`Abrindo ${url}`);
console.log("1. YouTube 16:9, cortes e zoom (padrão)");
await page.setInputFiles("#video-input", asUpload(VIDEO, "video/mp4"));
// O Chromium de código aberto não decodifica H.264 no <video>; nesse caso só o tamanho aparece
// antes da edição (Chrome/Edge mostram duração e resolução). O FFmpeg lê o vídeo de qualquer jeito.
await page.waitForFunction(() => document.getElementById("file-info").textContent.includes("MB"));
await page.waitForTimeout(1000);
ok(`informações do vídeo: ${await page.textContent("#file-info")}`);
let t0 = Date.now();
await page.click("#generate");
await waitDone();
if (await page.isVisible("#result")) {
  const file = await saveResult("site_youtube.mp4");
  ok(`pronto em ${((Date.now() - t0) / 1000).toFixed(0)} s: ${await page.textContent("#result-summary")}`);
  ok(`nome do download: ${await page.getAttribute("#download", "download")} -> salvo em ${file}`);
  checkMP4(file, [1280, 720], 7.27);
} else fail(`sem resultado: ${(await messages()).join(" | ")}`);

console.log("2. Música sem confirmar licença é bloqueada");
await page.check("#music-on");
await page.setInputFiles("#music-input", asUpload(MUSIC, "audio/mpeg"));
await page.click("#generate");
const blocked = (await messages()).some((m) => m.startsWith("error") && m.includes("direito de usar"));
if (blocked) ok("pediu a confirmação de licença e não começou");
else fail(`não bloqueou: ${(await messages()).join(" | ")}`);

console.log("3. Cancelar no meio");
await page.uncheck("#music-on");
await page.setInputFiles("#video-input", asUpload(LONG_VIDEO ?? VIDEO, "video/mp4"));
await page.click("#generate");
await page.waitForFunction(() => Number(document.getElementById("progress").value) > 150
  || document.querySelector("#msgs li.error"), null, { timeout: TIMEOUT });
await page.click("#cancel");
await page.waitForFunction(() => document.getElementById("cancel").hidden, null, { timeout: 60000 });
const cancelled = (await messages()).some((m) => m.includes("cancelada"));
const resultHidden = !(await page.isVisible("#result"));
if (cancelled && resultHidden) ok("cancelou, sem vídeo parcial");
else fail(`cancelamento: ${(await messages()).join(" | ")}`);

console.log("4. Shorts 9:16 (encaixar sem cortar) com música, depois do cancelamento");
await page.setInputFiles("#video-input", asUpload(VIDEO, "video/mp4"));
await page.check("input[name=format][value=vertical]");
await page.selectOption("#vertical-mode", "blur");
await page.selectOption("#profile", "CHALLENGE");
await page.check("#music-on");
await page.setInputFiles("#music-input", asUpload(MUSIC, "audio/mpeg"));
await page.check("#license");
t0 = Date.now();
await page.click("#generate");
await waitDone();
if (await page.isVisible("#result")) {
  const file = await saveResult("site_shorts.mp4");
  ok(`pronto em ${((Date.now() - t0) / 1000).toFixed(0)} s: ${await page.textContent("#result-summary")} -> ${file}`);
  checkMP4(file, [720, 1280], 7.27);
} else fail(`sem resultado: ${(await messages()).join(" | ")}`);

const relevantErrors = consoleErrors.filter((e) => !e.includes("favicon"));
if (relevantErrors.length) fail(`erros no console: ${relevantErrors.join(" | ")}`);
else ok("nenhum erro no console do navegador");
await browser.close();
console.log(failures ? `RESULTADO: ${failures} falha(s)` : "RESULTADO: tudo certo");
process.exit(failures ? 1 : 0);
