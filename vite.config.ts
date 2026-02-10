import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { claudePlugin } from "./src/server/claudePlugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), claudePlugin()],
});
