import { build } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

// The package publishes two flavors of the same bundle:
// - dist/jsenv_navi.js: import.meta.dev is false, dev-only code is tree-shaked
// - dist/dev/jsenv_navi.js: import.meta.dev is true, dev warnings and other
//   dev-only behavior are kept
// Consumers pick one via the "development" package export condition
// (resolved by Vite/webpack dev servers and jsenv dev server; their build
// resolves "production" and falls back to "default").
const naviEntryPointParams = ({ dev }) => ({
  buildRelativeUrl: "./jsenv_navi.js",
  mode: "package",
  dev,
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
});

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.js": naviEntryPointParams({ dev: false }),
    // The pure formatters, importable where preact is not installed (a
    // backend writing dates into notifications) — see format_time.js's own
    // top comment. Built as its own entry so `@jsenv/navi/format_time`
    // resolves to a bundle with no preact/@preact/signals in it.
    // Single flavor: it holds no dev-only code.
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

// After the main build: it cleans dist/ entirely, dist/dev/ must be
// (re)written afterwards.
await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/dev/"),
  entryPoints: {
    "./index.js": naviEntryPointParams({ dev: true }),
  },
});
