/*
 * Optimize source files and write them into "./dist/"
 * - npm run build
 * - npm run build:watch
 */

import { build } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";
import { jsenvPluginMinification } from "@jsenv/plugin-minification";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.html": "index.html",
  },
  plugins: [
    jsenvPluginPreact(),
    jsenvPluginBundling({
      js_module: {
        chunks: {
          vendors: { "file:///**/node_modules/": true },
        },
      },
    }),
    jsenvPluginMinification(),
  ],
});
