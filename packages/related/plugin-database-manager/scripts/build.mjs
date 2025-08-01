import { build } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./jsenv_plugin_database_manager.js": {
      runtimeCompat: {
        node: "16.2.0",
        chrome: "64",
        edge: "79",
        firefox: "67",
        safari: "11.3",
      },
      minification: false,
      versioning: false,
      plugins: [jsenvPluginPreact()],
    },
  },
});
