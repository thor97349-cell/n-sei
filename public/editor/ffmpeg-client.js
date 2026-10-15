// Cliente da página para o ffmpeg-worker.js. Cancelar = encerrar o worker (o FFmpeg não tem
// como ser interrompido de dentro); a próxima edição cria um worker novo.

// O ffmpeg.wasm é servido pelo próprio site: scripts/copy-ffmpeg-core.mjs copia o pacote
// @ffmpeg/core (versão travada no package.json) para public/editor/vendor/ no build.
export const CORE_VERSION = "0.12.10";
export const CORE_BASE = `/editor/vendor/ffmpeg-core-${CORE_VERSION}`;

export class CancelledError extends Error {
  constructor() { super("Edição cancelada."); }
}

export class WorkerFFmpeg {
  constructor({ workerURL = "/editor/ffmpeg-worker.js", coreBase = CORE_BASE } = {}) {
    this.workerURL = workerURL;
    this.coreBase = coreBase;
    this.worker = null;
    this.pending = new Map();
    this.nextId = 1;
    this.logListener = null;
    this.progressListener = null;
  }

  async load() {
    if (this.worker) return;
    this.worker = new Worker(this.workerURL);
    this.worker.onmessage = ({ data: { id, type, data } }) => {
      if (type === "log") return this.logListener?.(data.message);
      if (type === "progress") return this.progressListener?.(data);
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      if (type === "error") entry.reject(new Error(data));
      else entry.resolve(data);
    };
    this.worker.onerror = (event) => {
      const err = new Error(`Falha no processamento: ${event.message || "erro no worker"}`);
      for (const { reject } of this.pending.values()) reject(err);
      this.pending.clear();
    };
    try {
      await this.call("load", { coreURL: `${this.coreBase}/ffmpeg-core.js`, wasmURL: `${this.coreBase}/ffmpeg-core.wasm` });
    } catch (err) {
      this.terminate();
      throw new Error(`Não foi possível carregar o FFmpeg do navegador (${err.message}). Verifique a internet e recarregue a página.`);
    }
  }

  call(type, data, transfer = []) {
    if (!this.worker) return Promise.reject(new CancelledError());
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, data }, transfer);
    });
  }

  terminate() {
    if (!this.worker) return;
    this.worker.terminate();
    this.worker = null;
    for (const { reject } of this.pending.values()) reject(new CancelledError());
    this.pending.clear();
  }

  exec(args) { return this.call("exec", { args }); }
  ffprobe(args) { return this.call("ffprobe", { args }); }
  writeFile(path, data) { return this.call("writeFile", { path, data }); }
  readFile(path) { return this.call("readFile", { path }); }
  deleteFile(path) { return this.call("deleteFile", { path }); }
  mountFiles(files, mountPoint) { return this.call("mountFiles", { files, mountPoint }); }
  unmount(mountPoint) { return this.call("unmount", { mountPoint }); }
  setLogListener(fn) { this.logListener = fn; }
  setProgressListener(fn) { this.progressListener = fn; }
}
