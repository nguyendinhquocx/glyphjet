import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**", "**/.build/**"],
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
