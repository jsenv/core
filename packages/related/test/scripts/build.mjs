import { build } from "@jsenv/core";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.js": "jsenv_test.js",
  },
  ignore: {
    "file://**/node_modules/": true,
    // selectively allow some node_modules
    "file://**/node_modules/@jsenv/abort/": false,
    "file://**/node_modules/@jsenv/filesystem/": false,
    "file://**/node_modules/@jsenv/importmap/": false,
    "file://**/node_modules/@jsenv/integrity/": false,
    "file://**/node_modules/@jsenv/log/": false,
    "file://**/node_modules/@jsenv/url-meta/": false,
    "file://**/node_modules/@jsenv/urls/": false,
    "file://**/node_modules/@jsenv/utils/": false,
    "file://**/node_modules/@jsenv/uneval/": false,
    "file://**/node_modules/ansi-escapes/": false,
    "file://**/node_modules/is-unicode-supported/": false,
    "file://**/node_modules/supports-color/": false,
  },
  versioning: false,
  assetManifest: false,
  runtimeCompat: {
    node: "16.14",
  },
  scenarioPlaceholders: false,
  plugins: [jsenvPluginBundling()],
});