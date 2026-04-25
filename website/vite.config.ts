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
    // Lowered to es2015 so older Android TV WebViews (Chrome 60-70 era) can
    // still parse the bundle. esbuild transpiles ?? and ?. down to ES2015.
    target: "es2015",
    cssTarget: ["chrome61", "safari11", "firefox60", "edge18"],
  },
  esbuild: {
    target: "es2015",
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
