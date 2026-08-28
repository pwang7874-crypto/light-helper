import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const outputRoot = fileURLToPath(new URL("./dist-vefaas", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./vefaas-static", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [
    react(),
    {
      name: "copy-vefaas-caddy-config",
      closeBundle() {
        copyFileSync(
          fileURLToPath(new URL("./DefaultCaddyFile", import.meta.url)),
          fileURLToPath(new URL("./dist-vefaas/DefaultCaddyFile", import.meta.url)),
        );
      },
    },
  ],
  build: {
    outDir: outputRoot,
    emptyOutDir: true,
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
});
