import { jsenvPluginBundling } from "@jsenv/plugin-bundling";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../../src/", import.meta.url),
  buildDirectoryUrl: new URL("../../dist/", import.meta.url),
  entryPoints: {
    "./main.js": "jsenv_core.js",
  },
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  versioning: false,
  assetManifest: false,
  runtimeCompat: {
    node: "16.14",
  },
  directoryReferenceAllowed: (reference) => {
    return reference.url.includes("/babel_helpers/");
  },
  scenarioPlaceholders: false,
  referenceAnalysis: {
    include: {
      "file://**/*": true,
      "file://**/node_modules/": false,
      // selectively allow some node_modules
      "file://**/node_modules/@jsenv/abort/": true,
      "file://**/node_modules/@jsenv/ast/": false, // cannot inline "parse5", "@babel/core" and "postcss"
      "file://**/node_modules/@jsenv/babel-plugins/": true,
      "file://**/node_modules/@jsenv/filesystem/": true,
      "file://**/node_modules/@jsenv/importmap/": true,
      "file://**/node_modules/@jsenv/integrity/": true,
      "file://**/node_modules/@jsenv/log/": true,
      "file://**/node_modules/@jsenv/node-esm-resolution/": true,
      "file://**/node_modules/@jsenv/server/": true,
      "file://**/node_modules/@jsenv/plugin-placeholders/": true,
      "file://**/node_modules/@jsenv/sourcemap/": false, // cannot inline "source-map"
      "file://**/node_modules/@jsenv/url-meta/": true,
      "file://**/node_modules/@jsenv/urls/": true,
      "file://**/node_modules/@jsenv/utils/": true,
      "file://**/node_modules/ws/": true,
      "file://**/node_modules/ansi-escapes/": true,
      "file://**/node_modules/is-unicode-supported/": true,
      "file://**/node_modules/supports-color/": true,
    },
  },
  plugins: [
    jsenvPluginCommonJs({
      include: {
        "file:///**/node_modules/ws/": true,
      },
    }),
    jsenvPluginBundling(),
  ],
});

// "s.js" is used in the build files, it must be compatible as much as possible
// so we convert async/await, arrow function, ... to be compatible with
// old browsers
await build({
  sourceDirectoryUrl: new URL("../../src/", import.meta.url),
  buildDirectoryUrl: new URL("../../dist/js/", import.meta.url),
  entryPoints: {
    "./plugins/transpilation/js_module_fallback/client/s.js?as_js_classic":
      "s.js",
  },
  plugins: [jsenvPluginAsJsClassic()],
  directoryToClean: false,
  runtimeCompat: {
    chrome: "0",
    firefox: "0",
  },
  sourcemaps: "file",
  sourcemapsSourcesContent: true,
  versioning: false,
  assetManifest: false,
});
