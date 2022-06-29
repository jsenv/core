/*
 * Optimize source files and write them into "./dist/"
 * - npm run build
 * - npm run build:watch
 */

import { build } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

await build({
  rootDirectoryUrl,
  buildDirectoryUrl: new URL("./dist/", rootDirectoryUrl),
  entryPoints: {
    "./src/main.html": "index.html",
  },
  watch: process.argv.includes("--watch"),
})
