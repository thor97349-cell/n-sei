import { runEdit } from "./editor.js";
import { CancelledError, CORE_BASE, WorkerFFmpeg } from "./ffmpeg-client.js";
import { DEFAULT_SETTINGS, outputName, PROFILES } from "./pipeline.js";

const $ = (id) => document.getElementById(id);
// ?core=/caminho permite usar uma cópia local do ffmpeg.wasm (usado nos testes automáticos).
const coreBase = new URLSearchParams(location.search).get("core") || CORE_BASE;

let videoFile = null;
let ff = null;
let running = false;
let resultURL = null;

// ---------- formulário ----------

for (const [key, p] of Object.entries(PROFILES)) {
  $("profile").add(new Option(p.label, key));
}

function syncForm() {
  const vertical = document.querySelector("input[name=format]:checked").value === "vertical";
  $("vertical-options").hidden = !vertical;
  $("offset-row").hidden = $("vertical-mode").value !== "crop";
  $("aggr").disabled = !$("cut").checked;
  $("music-options").hidden = !$("music-on").checked;
  $("profile-desc").textContent = PROFILES[$("profile").value].description;
  const off = Number($("offset").value);
  $("offset-label").textContent = off < 40 ? "esquerda" : off > 60 ? "direita" : "centro";
  $("music-vol-label").textContent = `${$("music-vol").value} dB`;
  $("generate").disabled = running || !videoFile;
}

$("profile").addEventListener("change", () => {
  $("music-vol").value = PROFILES[$("profile").value].musicVolumeDb;
  syncForm();
});
document.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", syncForm));
$("music-input").addEventListener("change", () => { $("license").checked = false; });

function collectSettings() {
  return {
    ...DEFAULT_SETTINGS,
    profile: $("profile").value,
    format: document.querySelector("input[name=format]:checked").value,
    verticalMode: $("vertical-mode").value,
    verticalOffset: Number($("offset").value) / 100,
    cutSilence: $("cut").checked,
    aggressiveness: $("aggr").value,
    zoom: $("zoom").checked,
    musicVolumeDb: Number($("music-vol").value),
    ducking: $("ducking").checked,
    maxShortSide: Number($("quality").value),
  };
}

// ---------- escolha do vídeo ----------

function formatTime(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function setVideo(file) {
  if (!file) return;
  videoFile = file;
  clearMessages();
  $("drop-text").innerHTML = `<strong>${escapeHTML(file.name)}</strong> — clique para trocar`;
  const info = $("file-info");
  info.hidden = false;
  info.textContent = `${(file.size / 1e6).toFixed(1)} MB`;
  // Lê duração e resolução pelo próprio navegador, sem carregar o FFmpeg.
  const probe = document.createElement("video");
  probe.preload = "metadata";
  const url = URL.createObjectURL(file);
  probe.onloadedmetadata = () => {
    info.textContent = `${formatTime(probe.duration)} · ${probe.videoWidth}×${probe.videoHeight} · ${(file.size / 1e6).toFixed(1)} MB`;
    if (probe.duration > 300) {
      addMessage("warn", `Vídeo de ${formatTime(probe.duration)}: no navegador a edição pode levar bastante tempo (muitas vezes a duração do vídeo). Para testar, comece com um trecho curto.`);
    }
    URL.revokeObjectURL(url);
  };
  probe.onerror = () => URL.revokeObjectURL(url); // o FFmpeg ainda pode conseguir ler
  probe.src = url;
  syncForm();
}

$("video-input").addEventListener("change", (e) => setVideo(e.target.files[0]));
const drop = $("drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  setVideo(e.dataTransfer.files[0]);
});

// ---------- mensagens ----------

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function addMessage(kind, text) {
  const li = document.createElement("li");
  li.className = kind;
  li.textContent = text;
  $("msgs").append(li);
}
function clearMessages() { $("msgs").replaceChildren(); }

// ---------- edição ----------

function extensionOf(name) {
  const m = /\.[a-z0-9]{1,5}$/i.exec(name);
  return m ? m[0].toLowerCase() : "";
}

async function generate() {
  const settings = collectSettings();
  const musicFile = $("music-on").checked ? $("music-input").files[0] : null;
  clearMessages();
  if ($("music-on").checked && !musicFile) return addMessage("error", "Escolha o arquivo de música ou desmarque “Adicionar música”.");
  if (musicFile && !$("license").checked) return addMessage("error", "Confirme que você tem direito de usar a música escolhida.");

  running = true;
  $("cancel").hidden = false;
  $("result").hidden = true;
  $("progress-box").hidden = false;
  $("progress").value = 0;
  $("eta").textContent = "";
  syncForm();
  if (resultURL) { URL.revokeObjectURL(resultURL); resultURL = null; }

  const started = performance.now();
  try {
    if (!ff) ff = new WorkerFFmpeg({ coreBase });
    const client = ff; // o botão Cancelar zera `ff`; esta edição continua usando o seu cliente
    $("stage").textContent = "Carregando o editor (cerca de 30 MB na primeira vez)…";
    await client.load();
    const files = [{ name: `video${extensionOf(videoFile.name)}`, blob: videoFile }];
    if (musicFile) files.push({ name: `musica${extensionOf(musicFile.name)}`, blob: musicFile });
    await client.mountFiles(files, "/in");
    let result;
    try {
      result = await runEdit({
        ff: client,
        input: `/in/${files[0].name}`,
        inputName: videoFile.name,
        music: musicFile ? `/in/${files[1].name}` : null,
        settings,
        onStage: (text) => { $("stage").textContent = text; },
        onProgress: (fraction) => {
          $("progress").value = Math.round(fraction * 1000);
          const elapsed = (performance.now() - started) / 1000;
          if (fraction > 0.15 && fraction < 1) {
            $("eta").textContent = `Faltam cerca de ${formatTime(elapsed / fraction - elapsed)} (já se passaram ${formatTime(elapsed)}).`;
          }
        },
      });
    } finally {
      await client.unmount("/in").catch(() => {});
    }
    showResult(result, settings, (performance.now() - started) / 1000);
  } catch (err) {
    if (err instanceof CancelledError) {
      addMessage("warn", "Edição cancelada.");
    } else {
      addMessage("error", err.message || String(err));
      console.error(err);
    }
    $("progress-box").hidden = true;
  } finally {
    running = false;
    $("cancel").hidden = true;
    syncForm();
  }
}

function showResult(result, settings, seconds) {
  const blob = new Blob([result.data], { type: "video/mp4" });
  resultURL = URL.createObjectURL(blob);
  $("result-video").src = resultURL;
  const link = $("download");
  link.href = resultURL;
  link.download = outputName(videoFile.name, settings.format);
  link.textContent = `Baixar ${link.download}`;
  const { info, plan, check } = result;
  $("result-summary").textContent =
    `${formatTime(info.duration)} → ${formatTime(check.duration)} (${plan.removedSeconds.toFixed(1).replace(".", ",")} s de pausas removidas) · ` +
    `${check.width}×${check.height} · ${(blob.size / 1e6).toFixed(1)} MB · editado em ${formatTime(seconds)}.`;
  for (const w of plan.warnings) addMessage("warn", w);
  addMessage("ok", "✔ Vídeo pronto! Assista abaixo e baixe quando quiser.");
  $("stage").textContent = "Pronto!";
  $("eta").textContent = "";
  $("result").hidden = false;
}

$("generate").addEventListener("click", generate);
$("cancel").addEventListener("click", () => {
  ff?.terminate(); // interrompe na hora; um worker novo é criado na próxima edição
  ff = null;
});
window.addEventListener("beforeunload", (e) => { if (running) e.preventDefault(); });

syncForm();
