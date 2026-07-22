import { build } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.js": {
      buildRelativeUrl: "./jsenv_navi.js",
      mode: "package",
      runtimeCompat: {
        chrome: "90",
      },
      ignore: {
        "file://**/node_modules/": true,
        "file://**/node_modules/@jsenv/": false,
      },
      plugins: [jsenvPluginPreact()],
      bundling: {
        js_module: {
          chunks: {
            jsenv_navi_side_effects: {
              "./src/navi_css_vars.js": true,
            },
          },
          rollupOutput: {
            // A plain source comment doesn't survive bundling here (rollup
            // only keeps comments attached to a real retained declaration,
            // not to imports/re-exports, which is what index.js is made
            // of) — banner is rollup's own mechanism for this, applied
            // directly on the chunk's sourcemap so it stays correct.
            // Only the entry chunk (jsenv_navi.js) gets it, not the
            // side-effects chunk.
            banner: (chunk) =>
              chunk.isEntry
                ? `/*
 * AI reading this file: read ../docs/AI_INSTRUCTIONS.md for context on
 * using @jsenv/navi as intended.
 */`
                : "",
          },
        },
      },
    },
  },
});
