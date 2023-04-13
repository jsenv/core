/*
 * Optimize source files and write them into "./dist/"
 * - npm run build
 * - npm run build:watch
 */

import { build } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";
import { jsenvPluginMinification } from "@jsenv/plugin-minification";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  entryPoints: {
    "./main.html": "index.html",
  },
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  plugins: [
    jsenvPluginReact(),
    jsenvPluginBundling({
      js_module: {
        chunks: {
          vendors: { "file://**/node_modules/": true },
        },
      },
    }),
    jsenvPluginMinification(),
  ],
  watch: process.argv.includes("--watch"),
});
