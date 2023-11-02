/*
 * Optimize source files and write them into "./dist/"
 * Read more in https://github.com/jsenv/core/wiki
 */

import { build } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./index.html": "index.html",
  },
  plugins: [jsenvPluginReact()],
  bundling: {
    js_module: {
      chunks: {
        vendors: { "file:///**/node_modules/": true },
      },
    },
  },
});
