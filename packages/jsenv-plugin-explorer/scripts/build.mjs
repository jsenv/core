import { build } from "@jsenv/core";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./jsenv_plugin_explorer.js": "jsenv_plugin_explorer.js",
  },
  base: "./",
  runtimeCompat: {
    node: "16.2.0",
  },
  urlAnalysis: {
    include: {
      "/**/*": true,
      "/**/node_modules/": false,
    },
  },
  plugins: [jsenvPluginBundling()],
  versioning: false,
  subbuild: {
    "./client/explorer.html": () => {
      return {};
    },
  },
});
