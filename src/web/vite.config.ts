import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
) as { version: string };
const appVersion = process.env.APP_VERSION ?? pkg.version;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1500 },
});
