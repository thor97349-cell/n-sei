// Edição completa com o ffmpeg.wasm de verdade, rodando no Node (sem navegador).
// Usa o @ffmpeg/core instalado pelo npm (ou FFMPEG_CORE_ESM=/caminho/dist/esm) e o
// ffmpeg/ffprobe do sistema, só para gerar o vídeo de teste e conferir o resultado.
// Sem o core ou sem o ffmpeg do sistema, o teste é pulado (e diz o motivo).

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { runEdit } from "../../public/editor/editor.js";

const CORE = process.env.FFMPEG_CORE_ESM
  ?? (fs.existsSync("node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js") ? "node_modules/@ffmpeg/core/dist/esm" : null);
let SKIP = CORE ? false : "@ffmpeg/core não instalado (rode npm install)";
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { SKIP ||= "ffmpeg do sistema não encontrado"; }

async function loadCore() {
  globalThis.self ??= globalThis; // o core foi compilado para navegador/worker
  globalThis.location ??= { href: pathToFileURL(path.resolve(CORE, "ffmpeg-core.js")).href };
  const { default: create } = await import(pathToFileURL(path.resolve(CORE, "ffmpeg-core.js")).href);
  const core = await create({ wasmBinary: fs.readFileSync(path.join(CORE, "ffmpeg-core.wasm")) });
  try { core.FS.mkdir("/work"); } catch { /* existe */ }
  let logListener = null;
  let progressListener = null;
  core.setLogger(({ message }) => logListener?.(message));
  core.setProgress((p) => progressListener?.(p));
  const run = (method, args) => { core[method](...args); const ret = core.ret; core.reset(); return ret; };
  return {
    core,
    exec: async (args) => run("exec", args),
    ffprobe: async (args) => run("ffprobe", args),
    writeFile: async (p, d) => core.FS.writeFile(p, d),
    readFile: async (p) => core.FS.readFile(p),
    deleteFile: async (p) => core.FS.unlink(p),
    setLogListener: (fn) => { logListener = fn; },
    setProgressListener: (fn) => { progressListener = fn; },
  };
}

function ffprobeJSON(file) {
  return JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
}

test("edição completa no ffmpeg.wasm: cortes + zoom + música, MP4 válido", { skip: SKIP }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-wasm-"));
  const video = path.join(dir, "v.mp4");
  const music = path.join(dir, "m.m4a");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25",
    "-f", "lavfi", "-i", "aevalsrc='if(lt(mod(t\\,4)\\,2)\\,0.4*sin(2*PI*440*t)\\,0)':s=48000",
    "-t", "12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", video]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100", "-t", "4", "-c:a", "aac", music]);

  const ff = await loadCore();
  ff.core.FS.mkdir("/in");
  ff.core.FS.writeFile("/in/video.mp4", fs.readFileSync(video));
  ff.core.FS.writeFile("/in/musica.m4a", fs.readFileSync(music));

  const stages = [];
  const progress = [];
  const result = await runEdit({
    ff, input: "/in/video.mp4", inputName: "Avaliação.mp4", music: "/in/musica.m4a",
    settings: { profile: "FOOD_REVIEW", format: "vertical", verticalMode: "crop", maxShortSide: 720 },
    onStage: (s) => stages.push(s), onProgress: (p) => progress.push(p),
  });

  const out = path.join(dir, "saida.mp4");
  fs.writeFileSync(out, result.data);
  const probe = ffprobeJSON(out);
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  assert.equal(v.codec_name, "h264");
  assert.equal(a.codec_name, "aac");
  assert.deepEqual([v.width, v.height], [480, 854]); // 360p de origem -> nível 480 no vertical
  assert.ok(Math.abs(Number(probe.format.duration) - 7.25) < 0.3, `duração ${probe.format.duration}`);
  assert.equal(result.plan.segments.length, 3);
  assert.ok(result.plan.warnings.some((w) => w.includes("Reenquadramento")));
  assert.equal(progress.at(-1), 1);
  assert.equal(stages.at(-1), "Pronto!");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("arquivo que não é vídeo dá erro claro no ffmpeg.wasm", { skip: SKIP }, async () => {
  const ff = await loadCore();
  ff.core.FS.writeFile("/work/texto.mp4", new TextEncoder().encode("isto não é um vídeo"));
  await assert.rejects(
    runEdit({ ff, input: "/work/texto.mp4", inputName: "texto.mp4", settings: {} }),
    /Não foi possível ler "texto.mp4" como vídeo/,
  );
});
