import { defineConfig } from "vite";

/*
 * Builds `src/authority/authority.ts` into `dist/authority.js`: ONE self-contained,
 * import-free ES module. Two consumers impose that shape:
 *
 *   1. The KnockBox server evaluates it in a sandbox with NO module loader, so any
 *      surviving top-level `import` fails the whole game at lobby creation.
 *   2. `knockbox pack` scans the file for top-level imports and then dynamic-imports
 *      it in Node to assert `createAuthority` is a function. (That Node import is
 *      why package.json's `"type": "module"` is load-bearing — and why the file
 *      cannot be named `.mjs`: the packer requires the manifest path to end `.js`.)
 *
 * ORDER MATTERS: run this AFTER `vite build`. The app build owns dist/ and empties
 * it, so a bare `vite build` afterwards silently deletes dist/authority.js and the
 * next pack fails with "serverAuthority module not found in --in".
 */
export default defineConfig({
  // No plugins on purpose. The app config's UMD shim is serve-only, and nothing
  // should be injected into a module that runs in a bare sandbox.
  build: {
    outDir: "dist",
    emptyOutDir: false, // the app build already wrote dist/ — never wipe it
    copyPublicDir: false, // don't re-copy public/ on this second pass
    target: "es2020", // guards SYNTAX only; the sandbox's missing globals are an ESLint concern
    minify: false, // tiny module — keep it readable in server logs and packer errors
    sourcemap: false, // a //# sourceMappingURL would dangle inside the .kbg
    reportCompressedSize: false,
    lib: {
      entry: "src/authority/authority.ts",
      // Must be explicit: the default is ["es", "umd"], and the umd pass then
      // hard-errors demanding build.lib.name.
      formats: ["es"],
      // The FUNCTION form is used verbatim — no extension is appended. The string
      // form would produce `authority.js.js`.
      fileName: () => "authority.js",
    },
    rolldownOptions: {
      // Inline EVERYTHING (src/game/rules.ts, types.ts). Nothing may stay external:
      // the server has no module loader to resolve it with.
      external: [],
      // Never emit a sibling chunk — the manifest names exactly one file.
      output: { codeSplitting: false },
    },
  },
});
