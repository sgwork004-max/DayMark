import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: Number(process.env.MANAGER_DEV_PORT ?? 1420),
    strictPort: true,
    watch: {
      // Tauri watches src-tauri separately
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "chrome120",
    outDir: "dist",
  },
  envPrefix: ["VITE_", "TAURI_"],
});
