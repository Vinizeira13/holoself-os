import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri expects a fixed port
  server: {
    port: 1420,
    strictPort: true,
  },
  // Env variables starting with TAURI_ are exposed to Tauri
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
    // Produce sourcemaps for Tauri debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
  },
});
