/*
 * This file uses "@jsenv/core" to optimize source files and write them into "./dist/" directory.
 *
 * Read more at https://github.com/jsenv/jsenv-core/blob/master/docs/building/readme.md#jsenv-build
 */

import { build } from "@jsenv/core"

import { rootDirectoryUrl, plugins } from "../jsenv.config.mjs"

await build({
  rootDirectoryUrl,
  plugins,
  buildDirectoryUrl: new URL("./dist/", rootDirectoryUrl),
  entryPoints: {
    "./src/main.html": "index.html",
  },
  watch: process.argv.includes("--watch"),
})
