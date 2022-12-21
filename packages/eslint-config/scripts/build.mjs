/**
 *
 * This file uses "@jsenv/core" to convert source files
 * into commonjs and write them into dist/
 *
 * read more at
 * https://github.com/jsenv/jsenv-core/blob/master/docs/building/readme.md#node-package-build
 *
 */

import { build } from "@jsenv/core"

await build({
  rootDirectoryUrl: new URL("../", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./src/main.js": "jsenv_eslint_config.cjs",
  },
  runtimeCompat: {
    node: "16.14.0",
  },
  versioning: false,
  assetManifest: false,
  sourcemaps: true,
})
