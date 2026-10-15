// Web Worker clássico que roda o ffmpeg.wasm fora da thread da página (a tela não trava).
// Baseado no worker oficial do @ffmpeg/ffmpeg 0.12, com montagem WORKERFS para ler o vídeo
// do usuário aos pedaços, sem copiar o arquivo inteiro para a memória.

let core = null;

function load({ coreURL, wasmURL }) {
  importScripts(coreURL);
  return self.createFFmpegCore({
    // O core usa o "hash" desta URL para achar o .wasm (mesmo truque do @ffmpeg/ffmpeg).
    mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL, workerURL: "" }))}`,
  }).then((instance) => {
    core = instance;
    core.setLogger((data) => self.postMessage({ type: "log", data }));
    core.setProgress((data) => self.postMessage({ type: "progress", data }));
    try { core.FS.mkdir("/work"); } catch { /* já existe */ }
    return true;
  });
}

function run(method, args) {
  core.setTimeout(-1);
  core[method](...args);
  const ret = core.ret;
  core.reset();
  return ret;
}

const handlers = {
  load,
  exec: ({ args }) => run("exec", args),
  ffprobe: ({ args }) => run("ffprobe", args),
  writeFile: ({ path, data }) => { core.FS.writeFile(path, data); return true; },
  readFile: ({ path }) => core.FS.readFile(path),
  deleteFile: ({ path }) => { core.FS.unlink(path); return true; },
  // files: [{ name, blob }] -> disponíveis em mountPoint/name sem copiar para a memória.
  mountFiles: ({ files, mountPoint }) => {
    try { core.FS.mkdir(mountPoint); } catch { /* já existe */ }
    core.FS.mount(core.FS.filesystems.WORKERFS, { blobs: files.map((f) => ({ name: f.name, data: f.blob })) }, mountPoint);
    return true;
  },
  unmount: ({ mountPoint }) => { core.FS.unmount(mountPoint); return true; },
};

self.onmessage = async ({ data: { id, type, data } }) => {
  try {
    if (type !== "load" && !core) throw new Error("O FFmpeg ainda não foi carregado.");
    const handler = handlers[type];
    if (!handler) throw new Error(`Comando desconhecido: ${type}`);
    const result = await handler(data);
    const transfer = result instanceof Uint8Array ? [result.buffer] : [];
    self.postMessage({ id, type: "result", data: result }, transfer);
  } catch (err) {
    self.postMessage({ id, type: "error", data: String(err?.message ?? err) });
  }
};
