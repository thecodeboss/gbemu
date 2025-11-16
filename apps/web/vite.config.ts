import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
const runtimeRoot = fileURLToPath(
  new URL("../../packages/runtime/", import.meta.url),
);
const coreRoot = fileURLToPath(new URL("../../packages/core/", import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
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
        replacement: `${coreRoot}$1`,
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
});
