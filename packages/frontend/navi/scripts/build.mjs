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
        chrome: "123",
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
    // The pure formatters, importable where preact is not installed (a
    // backend writing dates into notifications) — see format_time.js's own
    // top comment. Built as its own entry so `@jsenv/navi/format_time`
    // resolves to a bundle with no preact/@preact/signals in it.
    "./src/text/format_time.js": {
      buildRelativeUrl: "./jsenv_navi_format_time.js",
      mode: "package",
      runtimeCompat: {
        chrome: "123",
        node: "20.0.0",
      },
      ignore: {
        "file://**/node_modules/": true,
        "file://**/node_modules/@jsenv/": false,
      },
    },
  },
});
