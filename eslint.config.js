import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

/**
 * Flat ESLint config. TypeScript-aware (non type-checked, so it stays fast and
 * needs no parserOptions.project), with Prettier last to switch off any rules
 * that would fight the formatter. Vendored JS (addons/, tools/) and build output
 * are excluded.
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-game/**",
      "node_modules/**",
      "addons/**",
      "tools/**",
      "public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // No-op lifecycle seams (reserved hooks) are intentional in this codebase.
      "@typescript-eslint/no-empty-function": "off",
      // Allow deliberately-unused args/vars when prefixed with `_`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  prettier,
);
