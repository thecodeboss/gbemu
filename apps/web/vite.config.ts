import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
const runtimeRoot = fileURLToPath(
  new URL("../../packages/runtime/", import.meta.url)
);

export default defineConfig({
  plugins: [
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
    ],
  },
});
