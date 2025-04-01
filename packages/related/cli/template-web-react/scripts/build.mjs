/*
 * Optimize source files and write them into "./dist/"
 * Read more in https://github.com/jsenv/core
 */

import { build } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.html": {
      plugins: [jsenvPluginReact()],
    },
  },
});
