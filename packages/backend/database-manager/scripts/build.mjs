import { build } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.js": {
      buildRelativeUrl: "./jsenv_database_manager.js",
      runtimeCompat: { node: "20.0" },
      directoryReferenceEffect: {
        [import.meta.resolve("../src/client/assets/")]: "resolve",
      },
      packageDependencies: {
        "@jsenv/server": "ignore",
      },
    },
    "./src/client/database_manager.html": {
      buildRelativeUrl: "./client/database_manager.html",
      runtimeCompat: { chrome: "89" },
      assetsDirectory: "client/assets/",
      plugins: [jsenvPluginPreact()],
    },
  },
});
