/*
 * Optimize source files and write them into "./dist/"
 * - npm run build
 * - npm run build:watch
 */

import { build } from "@jsenv/core"
import { jsenvPluginPreact } from "@jsenv/plugin-preact"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"
import { jsenvPluginMinification } from "@jsenv/plugin-minification"

await build({
  rootDirectoryUrl: new URL("../", import.meta.url),
  plugins: [
    jsenvPluginPreact(),
    jsenvPluginBundling(),
    jsenvPluginMinification(),
  ],
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./src/main.html": "index.html",
  },
  watch: process.argv.includes("--watch"),
})
