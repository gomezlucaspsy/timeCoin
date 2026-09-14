import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Publicar un artículo sube hasta 6 fotos en el mismo request.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
