import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

/**
 * Flat ESLint config. TypeScript-aware (non type-checked, so it stays fast and
 * needs no parserOptions.project), with Prettier last to switch off any rules
 * that would fight the formatter. The CLI-managed addons and build output are
 * excluded — see .prettierignore for why touching addons/ is a bad idea.
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "dist-game/**", "node_modules/**", "addons/**", "public/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    /*
     * Build-time tooling that runs in Node, not in a browser or the sandbox: it legitimately uses
     * `process`, `console`, `fetch` and timers, which are undefined as far as the browser-facing
     * config above is concerned.
     */
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
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
  {
    /*
     * THE SANDBOX GUARD. These files are bundled into `dist/authority.js` and run
     * inside the KnockBox server's sandbox, which has no DOM, no console, no
     * timers, no `process` — and actively DELETES the `Date` global. TypeScript
     * can't catch that on its own (`Date` is core ECMAScript, and
     * tsconfig.authority.json can only remove the DOM/Node libs), so it is banned
     * here instead.
     *
     * The import restriction is the important half: it stops `src/log.ts`
     * (which reads `import.meta.env`), `phaser` or `lit` being pulled into the
     * bundle graph, where they would drag DOM references into a module that has
     * no DOM. Only relative, DOM-free project imports are allowed.
     */
    files: ["src/authority/**/*.ts", "src/game/rules.ts", "src/game/types.ts"],
    ignores: ["src/authority/**/*.test.ts", "src/authority/fakeKb.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "The sandbox deletes Date — use kb.now()." },
        { name: "console", message: "There is no console in the sandbox — use kb.log.*" },
        { name: "fetch", message: "The sandbox has no network access." },
        { name: "setTimeout", message: "The sandbox has no timers — export tick(dtMs) instead." },
        { name: "setInterval", message: "The sandbox has no timers — export tick(dtMs) instead." },
        { name: "process", message: "The sandbox is not Node." },
        { name: "document", message: "The authority module has no DOM." },
        { name: "window", message: "The authority module has no DOM." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/^[^.]/]",
          message:
            "The authority module may only import relative project modules — a package import " +
            "would drag DOM/Node code into a bundle that runs in a bare sandbox.",
        },
      ],
    },
  },
  prettier,
);
