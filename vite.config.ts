import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "SnappaWidgetReact",
      fileName: () => "index.js",
      formats: ["es"],
    },
    minify: "esbuild",
    sourcemap: true,
    rollupOptions: {
      external: ["react", "react-dom"],
      output: {
        entryFileNames: "index.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  base: "./",
}));
