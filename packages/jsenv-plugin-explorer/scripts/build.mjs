import { build } from "@jsenv/core";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./jsenv_plugin_explorer.js": "jsenv_plugin_explorer.js",
  },
  ignore: {
    "/**/node_modules/": true,
  },
  runtimeCompat: {
    node: "16.2.0",
    chrome: "64",
    edge: "79",
    firefox: "67",
    safari: "11.3",
  },
  plugins: [jsenvPluginBundling()],
  versioning: false,
});
