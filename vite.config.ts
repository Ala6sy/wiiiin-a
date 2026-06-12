import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5000,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    watch: {
      ignored: ["**/.local/**", "**/node_modules/**"],
    },
    /* ── Gemini proxy: الطلب يمر عبر خادم ريبليت (لا المتصفح) ──
       هذا يتجاوز القيود الجغرافية للطبقة المجانية */
    proxy: {
      "/gemini-proxy": {
        target: "https://generativelanguage.googleapis.com",
        changeOrigin: true,
        secure: true,
        rewrite: (p: string) => p.replace(/^\/gemini-proxy/, ""),
      },
    },
  },
  preview: {
    port: 5000,
    host: "0.0.0.0",
  },
});
