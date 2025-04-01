import { build } from "@jsenv/core";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./main.js": {
      runtimeCompat: { node: "22.1" },
      buildRelativeUrl: "./jsenv_js_module_fallback.js",
      ignore: {
        "file://**/node_modules/": true,
      },
      scenarioPlaceholders: false,
    },
    "./client/s.js?as_js_classic": {
      // "s.js" is used in the build files, it must be compatible as much as possible
      // so we convert async/await, arrow function, ... to be compatible with
      // old browsers
      runtimeCompat: { chrome: "0", firefox: "0" },
      buildRelativeUrl: "./client/s.js",
      plugins: [jsenvPluginAsJsClassic()],
      sourcemaps: "file",
      sourcemapsSourcesContent: true,
      bundling: false,
      minification: false,
      versioning: false,
    },
  },
});
