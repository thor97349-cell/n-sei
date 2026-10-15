// Testes das regras de edição do site (node --test tests/editor).
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFramingFilter, buildRenderPlan, buildZoomFilter, chooseTargetSize, computeKeepSegments,
  computeRemovals, computeZoomWindows, cutPoints, InputError, outputName, parseProbe,
  parseSilencedetect, planEdit, PROFILES, silenceParams, silencedetectArgs, totalDuration,
} from "../../public/editor/pipeline.js";

const PARAMS = { thresholdDb: -35, minSilence: 0.8, padding: 0.25, longPause: 3.0, longPauseKeep: 1.6 };
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const info = (w, h, extra = {}) => ({ duration: 10, width: w, height: h, fps: 30, hasAudio: true, sar: 1, ...extra });

test("silencedetect: lê silêncios, inclusive o que vai até o fim", () => {
  const lines = ["[silencedetect @ 0x1] silence_start: 2.0",
    "[silencedetect @ 0x1] silence_end: 4.0 | silence_duration: 2.0", "silence_start: 10.5"];
  assert.deepEqual(parseSilencedetect(lines, 12), [[2, 4], [10.5, 12]]);
});

test("pausas curtas ficam; margem protege as palavras", () => {
  assert.deepEqual(computeRemovals(10, [[2, 2.6]], PARAMS), []);
  const [[s, e]] = computeRemovals(10, [[2, 4]], PARAMS);
  near(s, 2.25); near(e, 3.75);
});

test("pausa longa é encurtada, não removida", () => {
  const [[s, e]] = computeRemovals(20, [[5, 11]], PARAMS);
  near(6 - (e - s), 1.6);
});

test("vídeo todo em silêncio não é esvaziado", () => {
  assert.deepEqual(computeKeepSegments(5, [[0, 5]], PARAMS), [[0, 5]]);
});

test("trechos com som continuam inteiros (mesmo resultado do app Python)", () => {
  const segments = computeKeepSegments(12, [[2, 4], [6, 8], [10, 12]], PARAMS, 25);
  for (const [s, e] of [[0, 2], [4, 6], [8, 10]]) assert.ok(segments.some(([a, b]) => a <= s && e <= b));
  near(totalDuration(segments), 7.25, 0.05);
  assert.equal(cutPoints(segments).length, 2);
});

test("intensidade muda os parâmetros, com margem mínima", () => {
  const leve = silenceParams({ profile: "FOOD_REVIEW", aggressiveness: "leve" });
  const forte = silenceParams({ profile: "FOOD_REVIEW", aggressiveness: "forte" });
  assert.ok(leve.minSilence > forte.minSilence && leve.padding > forte.padding);
  assert.ok(forte.padding >= 0.12);
  assert.ok(silenceParams({ profile: "COOKING" }).minSilence > silenceParams({ profile: "CHALLENGE" }).minSilence);
});

test("tamanho de saída respeita o original e o limite de qualidade", () => {
  assert.deepEqual(chooseTargetSize(info(1920, 1080), "horizontal", 1080), [1920, 1080]);
  assert.deepEqual(chooseTargetSize(info(1920, 1080), "horizontal", 720), [1280, 720]);
  assert.deepEqual(chooseTargetSize(info(1920, 1080), "vertical", 720), [720, 1280]);
  assert.deepEqual(chooseTargetSize(info(640, 360), "horizontal", 1080), [854, 480]);
});

test("enquadramento: recorte central com aviso, ou encaixe sem cortar", () => {
  const crop = buildFramingFilter(info(1920, 1080), [1080, 1920], "vertical", "crop", 0.5);
  assert.match(crop.filter, /crop=608:1080:656:0/);
  assert.match(crop.warning, /central/);
  const left = buildFramingFilter(info(1920, 1080), [1080, 1920], "vertical", "crop", 0);
  assert.match(left.filter, /crop=608:1080:0:0/);
  const blur = buildFramingFilter(info(1920, 1080), [1080, 1920], "vertical", "blur");
  assert.match(blur.filter, /force_original_aspect_ratio=decrease/);
  assert.equal(blur.warning, null);
  const fit = buildFramingFilter(info(1080, 1920), [1920, 1080], "horizontal", "crop");
  assert.match(fit.filter, /boxblur/);
  assert.match(buildFramingFilter(info(1280, 720), [1920, 1080], "horizontal").filter, /^scale=1920:1080/);
});

test("zoom em cortes alternados, com intervalo mínimo", () => {
  const w = computeZoomWindows([2, 4, 11, 13, 25, 30], 40, 3, 8);
  assert.deepEqual(w.map(([s]) => s), [2, 13, 30]);
  assert.deepEqual(w[0], [2, 4]);
  assert.deepEqual(computeZoomWindows([], 30, 2, 10).map(([s]) => s), [5, 15, 25]);
  assert.equal(buildZoomFilter([], [1920, 1080], 1.08), null);
  assert.match(buildZoomFilter([[1, 2]], [1920, 1080], 1.08), /crop=1778:1000/);
});

test("ffprobe: erros claros para arquivos que não são vídeo", () => {
  assert.throws(() => parseProbe({ streams: [{ codec_type: "audio" }], format: { duration: "3" } }, "musica.mp3"), InputError);
  const rotated = parseProbe({ streams: [{ codec_type: "video", width: 1920, height: 1080, avg_frame_rate: "30000/1001",
    side_data_list: [{ rotation: -90 }] }], format: { duration: "5.0" } });
  assert.equal(rotated.width, 1080); assert.equal(rotated.height, 1920);
  near(rotated.fps, 29.97, 0.01); assert.equal(rotated.hasAudio, false);
});

test("plano completo: sem áudio ganha faixa silenciosa e aviso", () => {
  const plan = planEdit({ info: info(1280, 720, { hasAudio: false }), silences: [], settings: {},
    input: "/in/v.mp4", music: null, output: "/work/saida.mp4" });
  assert.match(plan.filterScript, /anullsrc/);
  assert.ok(plan.warnings.some((w) => w.includes("não tem áudio")));
  assert.deepEqual(plan.segments, [[0, 10]]);
});

test("plano completo: música com ducking e mapeamento das saídas", () => {
  const plan = planEdit({ info: info(1280, 720), silences: [[2, 4]], settings: { profile: "CHALLENGE" },
    input: "/in/v.mp4", music: "/in/m.mp3", output: "/work/saida.mp4" });
  assert.match(plan.filterScript, /sidechaincompress/);
  assert.match(plan.filterScript, /volume=-20\.0dB/);
  assert.ok(plan.args.includes("-stream_loop"));
  assert.deepEqual(plan.args.slice(-1), ["/work/saida.mp4"]);
  assert.equal(plan.segments.length, 2);
  const single = buildRenderPlan({ info: info(1280, 720), segments: [[0, 10]], framingFilter: "null",
    zoomFilter: null, input: "/in/v.mp4", music: null, output: "/o.mp4", normalizeVoice: false, musicVolumeDb: -24, ducking: true });
  assert.doesNotMatch(single.filterScript, /concat/);
});

test("nome de saída seguro, mantendo acentos", () => {
  assert.equal(outputName("Pão de açúcar: \"top\"?.MOV", "vertical"), "Pão de açúcar_ _top___editado_shorts.mp4");
  assert.equal(outputName("...", "horizontal"), "video_editado_youtube.mp4");
});

test("comandos pedem log informativo (o ffprobe do wasm deixa o nível em 'error')", () => {
  assert.deepEqual(silencedetectArgs("/in/v.mp4", -35).slice(0, 3), ["-hide_banner", "-loglevel", "info"]);
  const plan = planEdit({ info: info(1280, 720), silences: [], settings: {}, input: "/in/v.mp4", music: null, output: "/o.mp4" });
  assert.deepEqual(plan.args.slice(0, 3), ["-hide_banner", "-loglevel", "info"]);
});

test("os três perfis existem", () => {
  assert.deepEqual(Object.keys(PROFILES).sort(), ["CHALLENGE", "COOKING", "FOOD_REVIEW"]);
});

test("versão do ffmpeg.wasm no site = versão travada no package.json", async () => {
  const fs = await import("node:fs");
  const { CORE_VERSION, CORE_BASE } = await import("../../public/editor/ffmpeg-client.js");
  const pkg = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.devDependencies["@ffmpeg/core"], CORE_VERSION);
  assert.equal(CORE_BASE, `/editor/vendor/ffmpeg-core-${CORE_VERSION}`);
});
