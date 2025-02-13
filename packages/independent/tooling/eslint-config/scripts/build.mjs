/**
 *
 * This file uses "@jsenv/core" to convert source files
 * into commonjs and write them into dist/
 *
 * read more at
 * https://github.com/jsenv/core/blob/master/docs/building/readme.md#node-package-build
 *
 */

import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  entryPoints: {
    "./main.js": "jsenv_eslint_config.cjs",
  },
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  runtimeCompat: {
    node: "16.14.0",
  },
  sourcemaps: "file",
});
