import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { claudePlugin } from "./src/server/claudePlugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), claudePlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "zustand"],
        },
      },
    },
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
