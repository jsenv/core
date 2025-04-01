/*
 * Optimize source files and write them into "./dist/"
 * Read more in https://github.com/jsenv/core
 */

import { build } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.html": {
      plugins: [jsenvPluginPreact()],
    },
  },
});
