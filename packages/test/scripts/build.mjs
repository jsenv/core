import { build } from "@jsenv/core";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.js": "jsenv_test.js",
  },
  versioning: false,
  assetManifest: false,
  runtimeCompat: {
    node: "16.14",
  },
  scenarioPlaceholders: false,
  urlAnalysis: {
    include: {
      "file://**/*": true,
      "file://**/node_modules/": false,
      // selectively allow some node_modules
      "file://**/node_modules/@jsenv/abort/": true,
      "file://**/node_modules/@jsenv/filesystem/": true,
      "file://**/node_modules/@jsenv/importmap/": true,
      "file://**/node_modules/@jsenv/integrity/": true,
      "file://**/node_modules/@jsenv/log/": true,
      "file://**/node_modules/@jsenv/url-meta/": true,
      "file://**/node_modules/@jsenv/urls/": true,
      "file://**/node_modules/@jsenv/utils/": true,
      "file://**/node_modules/@jsenv/uneval/": true,
      "file://**/node_modules/ansi-escapes/": true,
      "file://**/node_modules/is-unicode-supported/": true,
      "file://**/node_modules/supports-color/": true,
    },
  },
  plugins: [jsenvPluginBundling()],
});
