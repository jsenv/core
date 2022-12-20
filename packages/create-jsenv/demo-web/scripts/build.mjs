/*
 * Optimize source files and write them into "./dist/"
 * - npm run build
 * - npm run build:watch
 */

import { build } from "@jsenv/core"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"
import { jsenvPluginMinification } from "@jsenv/plugin-minification"

await build({
  rootDirectoryUrl: new URL("../", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./src/main.html": "index.html",
  },
  plugins: [jsenvPluginBundling(), jsenvPluginMinification()],
  watch: process.argv.includes("--watch"),
})
