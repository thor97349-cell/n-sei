// Copia o ffmpeg.wasm (pacote @ffmpeg/core, versão travada no package-lock) para public/,
// para o editor em /editor carregá-lo do próprio site, sem depender de CDN.
// Roda sozinho depois de `npm install` (postinstall) e antes de `npm run build` (prebuild).
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync("node_modules/@ffmpeg/core/package.json", "utf8"));
const src = "node_modules/@ffmpeg/core/dist/umd";
const dest = path.join("public/editor/vendor", `ffmpeg-core-${pkg.version}`);
fs.mkdirSync(dest, { recursive: true });
for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
console.log(`ffmpeg.wasm ${pkg.version} copiado para ${dest}`);
