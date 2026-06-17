import preact from "@preact/preset-vite";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";

const frontendPort = Number(process.env.FRONTEND_PORT ?? process.env.PORT ?? "5173");
const host = process.env.HOST ? process.env.HOST.replace(/https?:\/\//, "") : "localhost";

const hmrConfig = host === "localhost" ? {
  protocol: "ws" as const,
  host: "localhost",
  port: 64999,
  clientPort: 64999,
} : {
  protocol: "wss" as const,
  host,
  port: frontendPort,
  clientPort: 443,
};

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  plugins: [preact()],
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: frontendPort,
    hmr: hmrConfig,
  },
});
