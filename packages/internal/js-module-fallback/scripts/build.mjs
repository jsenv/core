import { build } from "@jsenv/core";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.js": "jsenv_js_module_fallback.js",
  },
  ignore: {
    "file://**/node_modules/": true,
  },
  runtimeCompat: {
    node: "16.14",
  },
  scenarioPlaceholders: false,
});

// "s.js" is used in the build files, it must be compatible as much as possible
// so we convert async/await, arrow function, ... to be compatible with
// old browsers
await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/js/", import.meta.url),
  entryPoints: {
    "./client/s.js?as_js_classic": "s.js",
  },
  plugins: [jsenvPluginAsJsClassic()],
  directoryToClean: false,
  runtimeCompat: {
    chrome: "0",
    firefox: "0",
  },
  sourcemaps: "file",
  sourcemapsSourcesContent: true,
  bundling: false,
  minification: false,
  versioning: false,
});
