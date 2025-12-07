import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { analyzer } from "vite-bundle-analyzer";

const runtimeRoot = fileURLToPath(
  new URL("../../packages/runtime/", import.meta.url),
);
const coreRoot = fileURLToPath(
  new URL("../../packages/core/", import.meta.url),
);

export default defineConfig({
  build: {
    cssMinify: "lightningcss",
  },
  css: {
    transformer: "lightningcss",
  },
  plugins: [
    tailwindcss({ optimize: true }),
    preact(),
    analyzer({ analyzerMode: "static" }),
  ],
  resolve: {
    alias: [
      {
        find: /^@gbemu\/runtime$/,
        replacement: `${runtimeRoot}src/index.ts`,
      },
      {
        find: /^@gbemu\/runtime\/(.+)$/,
        replacement: `${runtimeRoot}$1`,
      },
      {
        find: /^@gbemu\/core$/,
        replacement: `${coreRoot}src/index.ts`,
      },
      {
        find: /^@gbemu\/core\/(.+)$/,
        replacement: `${coreRoot}src/$1`,
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
});
