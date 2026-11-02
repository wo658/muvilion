import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas", "dxf"],
  // Request-scoped rasterizer is loaded by Node, outside the Next.js bundle.
  outputFileTracingIncludes: { "/api/**": ["./server/plans/render-worker.mjs", "./node_modules/pdfjs-dist/**/*", "./node_modules/@napi-rs/**/*", "./node_modules/dxf/**/*"] },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    ...(process.env.NEXT_TURBOPACK_ROOT ? { root: process.env.NEXT_TURBOPACK_ROOT } : {}),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
