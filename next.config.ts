import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/imperio-sombras",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
