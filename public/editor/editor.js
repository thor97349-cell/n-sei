// Orquestra uma edição completa usando um "cliente FFmpeg" genérico:
//   { exec(args), ffprobe(args), writeFile(path, data), readFile(path), deleteFile(path),
//     setLogListener(fn|null), setProgressListener(fn|null) }
// No navegador o cliente fala com o Web Worker; nos testes, com o ffmpeg.wasm direto no Node.

import { InputError, parseProbe, parseSilencedetect, planEdit, silenceParams, silencedetectArgs } from "./pipeline.js";

export class EditError extends Error {}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function probe(ff, path, name) {
  const out = "/work/probe.json";
  await ff.deleteFile(out).catch(() => {}); // nunca reaproveitar o resultado de outro arquivo
  // No ffmpeg.wasm o ffprobe devolve -1 mesmo quando dá certo (ele "aborta" ao sair);
  // por isso o sucesso é medido pelo JSON gerado, não pelo código de retorno.
  await ff.ffprobe(["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path, "-o", out]);
  let data = null;
  try {
    data = JSON.parse(dec.decode(await ff.readFile(out)));
    await ff.deleteFile(out);
  } catch {
    data = null;
  }
  if (!data?.format) {
    throw new InputError(`Não foi possível ler "${name}" como vídeo. Confira se o arquivo é um vídeo (MP4, MOV…) e não está corrompido.`);
  }
  return data;
}

async function execCapturing(ff, args) {
  const lines = [];
  ff.setLogListener((msg) => lines.push(msg));
  try {
    const ret = await ff.exec(args);
    return { ret, lines };
  } finally {
    ff.setLogListener(null);
  }
}

function friendlyError(lines) {
  const text = lines.join("\n").toLowerCase();
  if (text.includes("out of memory") || text.includes("cannot enlarge memory")) {
    return "O navegador ficou sem memória. Tente um vídeo mais curto ou a qualidade “Rápida (720p)”.";
  }
  if (text.includes("invalid data found") || text.includes("moov atom not found")) {
    return "O arquivo parece corrompido ou incompleto.";
  }
  const last = lines.filter((l) => l.trim()).slice(-1)[0] ?? "erro desconhecido";
  return `O FFmpeg não conseguiu processar o vídeo (${last}).`;
}

/**
 * Executa a edição. `input`/`music` são caminhos já disponíveis no sistema de arquivos do FFmpeg.
 * onStage(texto) informa a etapa; onProgress(0..1) informa o progresso total.
 */
export async function runEdit({ ff, input, inputName, music = null, settings, onStage = () => {}, onProgress = () => {} }) {
  onStage("Lendo informações do vídeo…");
  onProgress(0);
  const info = parseProbe(await probe(ff, input, inputName), inputName);

  let silences = [];
  const cut = settings.cutSilence !== false && info.hasAudio;
  if (cut) {
    onStage("Procurando as pausas no áudio…");
    ff.setProgressListener(({ time }) => onProgress(Math.min(0.1, (time / 1e6 / info.duration) * 0.1)));
    const { ret, lines } = await execCapturing(ff, silencedetectArgs(input, silenceParams(settings).thresholdDb));
    ff.setProgressListener(null);
    if (ret !== 0) throw new EditError(friendlyError(lines));
    silences = parseSilencedetect(lines, info.duration);
  }
  onProgress(0.1);

  const output = "/work/saida.mp4";
  const plan = planEdit({ info, silences, settings, input, music, output });
  await ff.writeFile("/work/filtros.txt", enc.encode(plan.filterScript));

  onStage("Montando o vídeo editado… (é a parte mais demorada)");
  ff.setProgressListener(({ time }) => {
    if (time > 0) onProgress(0.1 + 0.85 * Math.min(1, time / 1e6 / plan.expectedDuration));
  });
  const { ret, lines } = await execCapturing(ff, plan.args);
  ff.setProgressListener(null);
  await ff.deleteFile("/work/filtros.txt").catch(() => {});
  if (ret !== 0) {
    await ff.deleteFile(output).catch(() => {});
    throw new EditError(friendlyError(lines));
  }

  onStage("Conferindo o arquivo final…");
  const check = parseOutputProbe(await probe(ff, output, "vídeo final"), plan.expectedDuration);
  const data = await ff.readFile(output);
  await ff.deleteFile(output).catch(() => {});
  onProgress(1);
  onStage("Pronto!");
  return { data, info, plan, check };
}

/** Confere se o MP4 final tem vídeo H.264, áudio AAC e a duração esperada. */
export function parseOutputProbe(data, expectedDuration) {
  const streams = data?.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  if (!video || video.codec_name !== "h264") throw new EditError("O vídeo final não tem a faixa de vídeo esperada (H.264).");
  if (!audio || audio.codec_name !== "aac") throw new EditError("O vídeo final não tem a faixa de áudio esperada (AAC).");
  const duration = Number(data.format?.duration) || 0;
  const tolerance = Math.max(0.5, expectedDuration * 0.02);
  if (Math.abs(duration - expectedDuration) > tolerance) {
    throw new EditError(`A duração do vídeo final (${duration.toFixed(1)} s) não bate com a esperada (${expectedDuration.toFixed(1)} s).`);
  }
  return { duration, width: Number(video.width), height: Number(video.height) };
}
