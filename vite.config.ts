/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base: the build works from any GitHub Pages sub-path or a plain folder.
export default defineConfig({
  base: "./",
  plugins: [react(), {
    // The published page names its commit, so a stale deployment can be told apart.
    name: "tt-build-stamp",
    transformIndexHtml: () => [{ tag: "meta", attrs: { name: "tt-build", content: process.env.GITHUB_SHA?.slice(0, 7) ?? "local" }, injectTo: "head" }]
  }],
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1500
  },
  test: {
    environment: "node",
    testTimeout: 20_000,
    include: ["src/**/*.test.ts"]
  }
});
