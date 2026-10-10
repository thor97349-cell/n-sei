import { defineConfig } from 'vite';

// host/allowedHosts make the dev server reachable from browser IDEs (Replit, Codespaces, cloud previews).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173, allowedHosts: true },
  preview: { host: true, port: 4173, allowedHosts: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
