// Regras de edição do FoodCreator Editor (versão web). Funções puras, sem DOM nem FFmpeg,
// para poderem ser testadas no Node. Mesma lógica do pipeline Python de foodcreator-editor/.

export const PROFILES = {
  FOOD_REVIEW: {
    label: "Avaliação de comida",
    description:
      "Restaurantes, lanches e doces. Prioriza reações e falas claras: pausas de degustação são encurtadas (não removidas) e os zooms marcam as reações.",
    thresholdDb: -35, minSilence: 0.8, padding: 0.25, longPause: 3.0, longPauseKeep: 1.6,
    zoomFactor: 1.08, zoomDuration: 2.5, zoomMinInterval: 7, musicVolumeDb: -24,
  },
  COOKING: {
    label: "Receita / preparo",
    description:
      "Receitas e passo a passo. Cortes conservadores para manter a sequência: só remove silêncio de verdade (o som do preparo fica) e mantém mais tempo nas pausas de demonstração.",
    thresholdDb: -40, minSilence: 1.2, padding: 0.35, longPause: 2.5, longPauseKeep: 2.0,
    zoomFactor: 1.05, zoomDuration: 3.5, zoomMinInterval: 15, musicVolumeDb: -26,
  },
  CHALLENGE: {
    label: "Desafio / experimento",
    description:
      "Desafios e testes. Ritmo mais rápido: corta pausas menores e usa zooms mais frequentes para marcar etapas, resultados e reações.",
    thresholdDb: -33, minSilence: 0.6, padding: 0.2, longPause: 4.0, longPauseKeep: 1.0,
    zoomFactor: 1.1, zoomDuration: 2.0, zoomMinInterval: 5, musicVolumeDb: -20,
  },
};

// Multiplicadores de [silêncio mínimo, margem, pausa longa mantida].
const AGGRESSIVENESS = { leve: [1.5, 1.3, 1.3], medio: [1, 1, 1], forte: [0.7, 0.8, 0.7] };
export const MIN_SPEECH_PADDING = 0.12; // nunca corta mais perto da fala que isso
const DETECT_MIN_DURATION = 0.25;
const MIN_CUT = 0.2;
const EDGE = 0.05;

export const DEFAULT_SETTINGS = {
  profile: "FOOD_REVIEW",
  format: "horizontal", // ou "vertical"
  verticalMode: "crop", // ou "blur"
  verticalOffset: 0.5,
  cutSilence: true,
  aggressiveness: "medio",
  zoom: true,
  musicVolumeDb: null, // null = usa o do perfil
  ducking: true,
  normalizeVoice: false,
  maxShortSide: 720, // 720 = mais rápido no navegador; 1080 = qualidade máxima
};

export function silenceParams(settings) {
  const p = PROFILES[settings.profile] ?? PROFILES.FOOD_REVIEW;
  const [fMin, fPad, fKeep] = AGGRESSIVENESS[settings.aggressiveness] ?? AGGRESSIVENESS.medio;
  return {
    thresholdDb: p.thresholdDb,
    minSilence: Math.max(0.3, p.minSilence * fMin),
    padding: Math.max(MIN_SPEECH_PADDING, p.padding * fPad),
    longPause: Math.max(1, p.longPause),
    longPauseKeep: Math.max(0, p.longPauseKeep * fKeep),
  };
}

// "-loglevel info" é obrigatório: no ffmpeg.wasm tudo roda no mesmo processo e o "-v error"
// do ffprobe anterior continuaria valendo, escondendo as linhas do silencedetect.
export function silencedetectArgs(input, thresholdDb) {
  return ["-hide_banner", "-loglevel", "info", "-nostats", "-i", input, "-map", "0:a:0", "-vn", "-sn", "-dn",
    "-af", `silencedetect=noise=${thresholdDb}dB:d=${DETECT_MIN_DURATION}`, "-f", "null", "-"];
}

export function parseSilencedetect(lines, duration) {
  const silences = [];
  let start = null;
  for (const line of lines) {
    let m = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (m) { start = Math.max(0, parseFloat(m[1])); continue; }
    m = /silence_end:\s*(-?[\d.]+)/.exec(line);
    if (m && start !== null) {
      const end = Math.min(duration, parseFloat(m[1]));
      if (end > start) silences.push([start, end]);
      start = null;
    }
  }
  if (start !== null && duration > start) silences.push([start, duration]);
  return silences;
}

export function computeRemovals(duration, silences, params) {
  const removals = [];
  for (let [s, e] of [...silences].sort((a, b) => a[0] - b[0])) {
    s = Math.max(0, s); e = Math.min(duration, e);
    const length = e - s;
    if (length < params.minSilence) continue;
    let side = params.padding;
    if (length >= params.longPause) side = Math.max(side, params.longPauseKeep / 2);
    const atStart = s <= EDGE;
    const atEnd = e >= duration - EDGE;
    if (atStart && atEnd) continue; // vídeo inteiro em silêncio: não remove nada
    const cutStart = atStart ? s : s + side;
    const cutEnd = atEnd ? e : e - side;
    if (cutEnd - cutStart >= MIN_CUT) removals.push([cutStart, cutEnd]);
  }
  return removals;
}

const snap = (v, fps) => (fps > 0 ? Math.round(v * fps) / fps : v);

export function computeKeepSegments(duration, silences, params, fps = 0) {
  const segments = [];
  let cursor = 0;
  for (const [rs, re] of computeRemovals(duration, silences, params)) {
    if (rs > cursor) segments.push([cursor, rs]);
    cursor = Math.max(cursor, re);
  }
  if (cursor < duration) segments.push([cursor, duration]);
  const snapped = [];
  for (const [s, e] of segments) {
    let s2 = s <= 0 ? 0 : snap(s, fps);
    const e2 = e >= duration ? duration : snap(e, fps);
    if (snapped.length && s2 < snapped[snapped.length - 1][1]) s2 = snapped[snapped.length - 1][1];
    if (e2 > s2) snapped.push([s2, e2]);
  }
  return snapped.length ? snapped : [[0, duration]];
}

export const totalDuration = (segments) => segments.reduce((acc, [s, e]) => acc + (e - s), 0);

export function cutPoints(segments) {
  const points = [];
  let acc = 0;
  segments.forEach(([s, e], i) => { if (i > 0) points.push(acc); acc += e - s; });
  return points;
}

function fraction(text) {
  if (!text || text === "0/0" || text === "N/A") return 0;
  const [a, b] = String(text).split("/").map(Number);
  const v = b === undefined ? a : b ? a / b : 0;
  return Number.isFinite(v) ? v : 0;
}

function rotation(stream) {
  const tag = stream.tags?.rotate;
  if (tag !== undefined && !Number.isNaN(Number(tag))) return ((Number(tag) % 360) + 360) % 360;
  for (const side of stream.side_data_list ?? []) {
    if (side.rotation !== undefined) return ((Number(side.rotation) % 360) + 360) % 360;
  }
  return 0;
}

export class InputError extends Error {}

/** Converte o JSON do ffprobe em informações do vídeo. Lança InputError se não for vídeo. */
export function parseProbe(data, name = "arquivo") {
  const streams = data?.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  if (!video) throw new InputError(`"${name}" não contém vídeo.`);
  const audio = streams.find((s) => s.codec_type === "audio");
  const duration = fraction(data.format?.duration) || fraction(video.duration);
  if (!(duration > 0)) throw new InputError(`Não foi possível descobrir a duração de "${name}".`);
  let width = Number(video.width) || 0;
  let height = Number(video.height) || 0;
  if (!width || !height) throw new InputError(`Não foi possível descobrir a resolução de "${name}".`);
  if ([90, 270].includes(rotation(video))) [width, height] = [height, width];
  let fps = fraction(video.avg_frame_rate) || fraction(video.r_frame_rate) || 30;
  if (fps < 1 || fps > 240) fps = 30;
  let sar = fraction(video.sample_aspect_ratio) || 1;
  if (sar < 0.25 || sar > 4) sar = 1;
  return { duration, width, height, fps, hasAudio: Boolean(audio), sar, videoCodec: video.codec_name };
}

const LEVELS = [[1080, [1920, 1080]], [720, [1280, 720]], [480, [854, 480]]];

/** Tamanho de saída: nunca acima do original nem acima de maxShortSide. */
export function chooseTargetSize(info, format, maxShortSide = 1080) {
  const shortSide = Math.min(Math.round(info.width * info.sar), info.height);
  let size = LEVELS[LEVELS.length - 1][1];
  for (const [level, levelSize] of LEVELS) {
    if (level <= maxShortSide && shortSide >= level * 0.95) { size = levelSize; break; }
  }
  const [w, h] = size;
  return format === "vertical" ? [h, w] : [w, h];
}

const even = (v) => Math.max(2, Math.round(v / 2) * 2);

function describeOffset(offset) {
  if (offset < 0.4) return "deslocado para a esquerda";
  if (offset > 0.6) return "deslocado para a direita";
  return "central";
}

export function buildFramingFilter(info, [tw, th], format, verticalMode = "crop", offset = 0.5) {
  let prefix = "";
  let srcW = info.width;
  const srcH = info.height;
  if (Math.abs(info.sar - 1) > 0.01) {
    srcW = even(info.width * info.sar);
    prefix = `scale=${srcW}:${srcH},setsar=1,`;
  }
  const srcAspect = srcW / srcH;
  const dstAspect = tw / th;
  if (Math.abs(srcAspect - dstAspect) / dstAspect <= 0.01) {
    return { filter: `${prefix}scale=${tw}:${th}:flags=lanczos,setsar=1`, warning: null };
  }
  if (format === "vertical" && verticalMode === "crop") {
    offset = Math.min(1, Math.max(0, offset));
    if (srcAspect > dstAspect) {
      const cropW = Math.min(srcW, even(srcH * dstAspect));
      const x = Math.floor((srcW - cropW) * offset);
      return {
        filter: `${prefix}crop=${cropW}:${srcH}:${x}:0,scale=${tw}:${th}:flags=lanczos,setsar=1`,
        warning:
          `Reenquadramento vertical sem detecção automática de rosto/comida: foi usado um recorte ${describeOffset(offset)}. ` +
          "Confira se nada importante ficou de fora; se ficou, mude a posição do recorte ou use “Encaixar sem cortar”.",
      };
    }
    const cropH = Math.min(srcH, even(srcW / dstAspect));
    const y = Math.floor((srcH - cropH) / 2);
    return { filter: `${prefix}crop=${srcW}:${cropH}:0:${y},scale=${tw}:${th}:flags=lanczos,setsar=1`, warning: null };
  }
  // Encaixa a imagem inteira, com fundo desfocado dela mesma.
  const bw = even(tw / 4);
  const bh = even(th / 4);
  return {
    filter:
      `${prefix}split=2[fc_bg][fc_fg];` +
      `[fc_bg]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},boxblur=10:2,scale=${tw}:${th},setsar=1[fc_bgs];` +
      `[fc_fg]scale=${tw}:${th}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,setsar=1[fc_fgs];` +
      "[fc_bgs][fc_fgs]overlay=(W-w)/2:(H-h)/2,setsar=1",
    warning: null,
  };
}

/** Zooms em cortes alternados (disfarçam a emenda), respeitando um intervalo mínimo. */
export function computeZoomWindows(cuts, duration, zoomDuration, minInterval) {
  zoomDuration = Math.max(0.5, zoomDuration);
  minInterval = Math.max(zoomDuration + 0.5, minInterval);
  const starts = [];
  let last = -minInterval;
  let useThisCut = true;
  for (const t of cuts) {
    if (t - last < minInterval) continue;
    if (useThisCut) { starts.push(t); last = t; }
    useThisCut = !useThisCut;
  }
  if (!starts.length) {
    for (let t = minInterval / 2; t < duration - 1; t += minInterval) starts.push(t);
  }
  const windows = [];
  for (const s of starts) {
    let end = Math.min(duration, s + zoomDuration);
    const later = cuts.filter((c) => s + 1 <= c && c < end);
    if (later.length) end = later[0];
    if (windows.length && s < windows[windows.length - 1][1]) continue;
    if (end - s >= 0.5) windows.push([round3(s), round3(end)]);
  }
  return windows;
}

const round3 = (v) => Math.round(v * 1000) / 1000;

export function buildZoomFilter(windows, [w, h], factor) {
  if (!windows.length || factor <= 1.001) return null;
  const cw = Math.max(2, Math.round(w / factor / 2) * 2);
  const ch = Math.max(2, Math.round(h / factor / 2) * 2);
  const enable = windows.map(([s, e]) => `between(t,${s.toFixed(3)},${e.toFixed(3)})`).join("+");
  return (
    "split=2[zm_base][zm_src];" +
    `[zm_src]crop=${cw}:${ch}:(iw-${cw})/2:(ih-${ch})/2,scale=${w}:${h}:flags=lanczos,setsar=1[zm_big];` +
    `[zm_base][zm_big]overlay=0:0:enable='${enable}'`
  );
}

const AUDIO_FORMAT = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";

export function buildAudioGraph({ voice, music, duration, normalizeVoice, musicVolumeDb, ducking }) {
  const lines = [];
  if (voice) {
    let chain = AUDIO_FORMAT;
    if (normalizeVoice) chain += `,loudnorm=I=-16:TP=-1.5:LRA=11,${AUDIO_FORMAT}`;
    lines.push(`[${voice}]${chain}[voice]`);
  }
  if (music) {
    const fadeStart = Math.max(0, duration - 2);
    lines.push(
      `[${music}]${AUDIO_FORMAT},volume=${musicVolumeDb.toFixed(1)}dB,atrim=0:${duration.toFixed(3)},` +
      `asetpts=PTS-STARTPTS,afade=t=out:st=${fadeStart.toFixed(3)}:d=2[music]`,
    );
  }
  const mix = "amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]";
  if (voice && music) {
    if (ducking) {
      lines.push("[voice]asplit=2[voice_mix][voice_key]");
      lines.push("[music][voice_key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500[music_duck]");
      lines.push(`[voice_mix][music_duck]${mix}`);
    } else {
      lines.push(`[voice][music]${mix}`);
    }
  } else if (voice) lines.push("[voice]anull[aout]");
  else if (music) lines.push("[music]anull[aout]");
  else lines.push(`anullsrc=r=48000:cl=stereo,atrim=0:${duration.toFixed(3)}[aout]`);
  return lines;
}

export function outputFps(fps) {
  fps = Math.min(60, Math.max(1, fps));
  if (Math.abs(fps - Math.round(fps)) < 0.01) return String(Math.round(fps));
  if (Math.abs(fps - 29.97) < 0.01) return "30000/1001";
  if (Math.abs(fps - 59.94) < 0.01) return "60000/1001";
  if (Math.abs(fps - 23.976) < 0.01) return "24000/1001";
  return fps.toFixed(3);
}

/**
 * Monta o filtergraph e os argumentos do FFmpeg para a renderização completa.
 * Cortes (trim + concat), FPS constante, enquadramento, zoom e áudio, num único comando.
 */
export function buildRenderPlan({ info, segments, framingFilter, zoomFilter, input, music, output,
  normalizeVoice, musicVolumeDb, ducking, filterScriptPath = "/work/filtros.txt" }) {
  const n = segments.length;
  const duration = totalDuration(segments);
  const lines = [];
  const has = info.hasAudio;
  if (n === 1) {
    const [s, e] = segments[0];
    lines.push(`[0:v:0]trim=start=${s.toFixed(4)}:end=${e.toFixed(4)},setpts=PTS-STARTPTS[vcat]`);
    if (has) lines.push(`[0:a:0]atrim=start=${s.toFixed(4)}:end=${e.toFixed(4)},asetpts=PTS-STARTPTS[acat]`);
  } else {
    lines.push(`[0:v:0]split=${n}` + segments.map((_, i) => `[vs${i}]`).join(""));
    if (has) lines.push(`[0:a:0]asplit=${n}` + segments.map((_, i) => `[as${i}]`).join(""));
    const pads = [];
    segments.forEach(([s, e], i) => {
      lines.push(`[vs${i}]trim=start=${s.toFixed(4)}:end=${e.toFixed(4)},setpts=PTS-STARTPTS[v${i}]`);
      pads.push(`[v${i}]`);
      if (has) {
        lines.push(`[as${i}]atrim=start=${s.toFixed(4)}:end=${e.toFixed(4)},asetpts=PTS-STARTPTS[a${i}]`);
        pads.push(`[a${i}]`);
      }
    });
    lines.push(pads.join("") + `concat=n=${n}:v=1:a=${has ? 1 : 0}` + (has ? "[vcat][acat]" : "[vcat]"));
  }
  lines.push(`[vcat]fps=${outputFps(info.fps)},${framingFilter}[vframe]`);
  let current = "vframe";
  if (zoomFilter) { lines.push(`[${current}]${zoomFilter}[vzoom]`); current = "vzoom"; }
  lines.push(`[${current}]format=yuv420p[vout]`);
  lines.push(...buildAudioGraph({
    voice: has ? "acat" : null, music: music ? "1:a:0" : null, duration, normalizeVoice, musicVolumeDb, ducking,
  }));

  const args = ["-hide_banner", "-loglevel", "info", "-nostdin", "-y", "-i", input];
  if (music) args.push("-stream_loop", "-1", "-i", music);
  args.push(
    "-filter_complex_script", filterScriptPath,
    "-map", "[vout]", "-map", "[aout]",
    // veryfast: no navegador o FFmpeg é bem mais lento que no PC; troca um pouco de tamanho por velocidade.
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-map_metadata", "-1", "-metadata:s:a:0", "language=por", "-movflags", "+faststart",
    "-max_muxing_queue_size", "4096", "-t", duration.toFixed(3), "-f", "mp4", output,
  );
  const warnings = [];
  if (!has) {
    warnings.push(
      "O vídeo não tem áudio: não houve cortes de silêncio" +
      (music ? "." : ", e foi adicionada uma faixa de áudio silenciosa."),
    );
  }
  return { args, filterScript: lines.join(";\n"), expectedDuration: duration, warnings };
}

/** Planeja a edição inteira a partir da análise do vídeo. Puro: não executa nada. */
export function planEdit({ info, silences, settings, input, music, output }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const profile = PROFILES[s.profile] ?? PROFILES.FOOD_REVIEW;
  const params = silenceParams(s);
  const warnings = [];
  const segments = s.cutSilence && info.hasAudio
    ? computeKeepSegments(info.duration, silences ?? [], params, info.fps)
    : [[0, info.duration]];
  const removed = info.duration - totalDuration(segments);
  if (removed > info.duration * 0.6) {
    warnings.push(
      `Os cortes removeram ${Math.round((removed / info.duration) * 100)}% do vídeo. Se o áudio estiver baixo, use a intensidade “Leve”.`,
    );
  }
  const target = chooseTargetSize(info, s.format, s.maxShortSide);
  const framing = buildFramingFilter(info, target, s.format, s.verticalMode, s.verticalOffset);
  if (framing.warning) warnings.push(framing.warning);
  let zoomFilter = null;
  if (s.zoom) {
    const duration = totalDuration(segments);
    const windows = computeZoomWindows(cutPoints(segments), duration, profile.zoomDuration, profile.zoomMinInterval);
    zoomFilter = buildZoomFilter(windows, target, profile.zoomFactor);
  }
  const plan = buildRenderPlan({
    info, segments, framingFilter: framing.filter, zoomFilter, input, music, output,
    normalizeVoice: s.normalizeVoice,
    musicVolumeDb: s.musicVolumeDb ?? profile.musicVolumeDb,
    ducking: s.ducking,
  });
  return { ...plan, segments, target, removedSeconds: removed, warnings: [...warnings, ...plan.warnings] };
}

/** Nome do arquivo de saída: mantém acentos, remove caracteres proibidos no Windows. */
export function outputName(inputName, format) {
  let stem = String(inputName).replace(/\.[^.]+$/, "").normalize("NFC");
  stem = stem.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
  if (!stem) stem = "video";
  return `${stem.slice(0, 120)}_editado_${format === "vertical" ? "shorts" : "youtube"}.mp4`;
}
