import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites() {
    return [
      // Editor de vídeos FoodCreator: página estática em public/editor/.
      { source: "/editor", destination: "/editor/index.html" },
      // FAÍSCA, jogo de sobrevivência em canvas: página estática em public/jogo/.
      { source: "/jogo", destination: "/jogo/index.html" },
    ];
  },
  headers() {
    return [
      {
        // ffmpeg.wasm (32 MB): a pasta leva a versão no nome, então pode ficar em cache por um ano.
        source: "/editor/vendor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
