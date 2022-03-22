/*
 * TODO
 * - test sourcemap generation without versioning
 * - test sourcemap generation with versioning
 *   (unfortunately we won't be able to compose rollup sourcemap... we'll try if possible with parcel)
 * - no version on html file
 */

import { build } from "@jsenv/core/src/build/build.js"

await build({
  logLevel: "debug",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  sourcemapMethod: "file",
  versioning: false,
})
