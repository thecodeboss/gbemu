import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tailwindcss from "eslint-plugin-tailwindcss";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

const webTailwindCssPath = new URL("./apps/web/src/index.css", import.meta.url)
  .pathname;

export default defineConfig([
  globalIgnores(["**/dist/**/*"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      unicorn,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "no-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "unicorn/filename-case": ["error"],
    },
  },
  {
    files: ["**/web/**/*.{ts,tsx}"],
    extends: [
      pluginReact.configs.flat.recommended,
      pluginReact.configs.flat["jsx-runtime"],
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    plugins: {
      tailwindcss,
    },
    settings: {
      react: {
        version: "detect",
      },
      tailwindcss: {
        callees: ["cn"],
        config: webTailwindCssPath,
      },
    },
    rules: {
      "tailwindcss/no-unnecessary-arbitrary-value": "warn",
    },
  },
]);
