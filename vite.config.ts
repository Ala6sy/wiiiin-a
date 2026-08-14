import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/** Hostinger site — PHP (ai_proxy, api, PDF) runs here; Vite dev proxies to it */
const DEFAULT_PHP_TARGET = "https://eng-alaa.com";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const phpTarget = env.VITE_PHP_PROXY_TARGET || DEFAULT_PHP_TARGET;

  const phpProxy = {
    target: phpTarget,
    changeOrigin: true,
    secure: true,
  };

  return {
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
      port: 5173,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      watch: {
        ignored: ["**/.local/**", "**/node_modules/**"],
      },
      proxy: {
        /* Local dev: forward PHP to Hostinger (Vite cannot run PHP) */
        "/ai_proxy.php": phpProxy,
        "/generate_report.php": phpProxy,
        "/generate_customer_report.php": phpProxy,
        "/api": phpProxy,
        "/gemini-proxy": {
          target: "https://generativelanguage.googleapis.com",
          changeOrigin: true,
          secure: true,
          rewrite: (p: string) => p.replace(/^\/gemini-proxy/, ""),
        },
      },
    },
    preview: {
      port: 5173,
      host: "0.0.0.0",
    },
  };
});
