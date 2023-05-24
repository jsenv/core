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
  ignore: {
    "file://**/node_modules/": true,
    // selectively unignore some node_modules
    "file://**/node_modules/@jsenv/abort/": false,
    "file://**/node_modules/@jsenv/ast/": true, // cannot inline "parse5", "@babel/core" and "postcss"
    "file://**/node_modules/@jsenv/babel-plugins/": false,
    "file://**/node_modules/@jsenv/filesystem/": false,
    "file://**/node_modules/@jsenv/importmap/": false,
    "file://**/node_modules/@jsenv/integrity/": false,
    "file://**/node_modules/@jsenv/log/": false,
    "file://**/node_modules/@jsenv/node-esm-resolution/": false,
    "file://**/node_modules/@jsenv/server/": false,
    "file://**/node_modules/@jsenv/plugin-placeholders/": false,
    "file://**/node_modules/@jsenv/sourcemap/": true, // cannot inline "source-map"
    "file://**/node_modules/@jsenv/url-meta/": false,
    "file://**/node_modules/@jsenv/urls/": false,
    "file://**/node_modules/@jsenv/utils/": false,
    "file://**/node_modules/ws/": false,
    "file://**/node_modules/ansi-escapes/": false,
    "file://**/node_modules/is-unicode-supported/": false,
    "file://**/node_modules/supports-color/": false,
  },
  directoryReferenceAllowed: (reference) => {
    return reference.url.includes("/babel_helpers/");
  },
  versioning: false,
  assetManifest: false,
  runtimeCompat: {
    node: "16.14",
  },
  scenarioPlaceholders: false,
  plugins: [
    jsenvPluginCommonJs({
      include: {
        "file:///**/node_modules/ws/": true,
      },
    }),
    jsenvPluginBundling(),
  ],
  // for debug
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
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
