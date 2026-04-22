import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "src", "shared"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: ["es2018", "chrome70", "safari12", "firefox68", "edge79"],
    cssTarget: ["chrome70", "safari12", "firefox68", "edge79"],
  },
  esbuild: {
    target: "es2018",
  },
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
