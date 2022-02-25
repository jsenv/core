/*
 * This file uses "@jsenv/core" to convert source files into commonjs format
 * and write them into "./dist/" directory.
 *
 * Read more at https://github.com/jsenv/jsenv-core/blob/master/docs/building/readme.md#node-package-build
 */

import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("../../../", import.meta.url),
  buildDirectoryRelativeUrl: "./dist/",
  format: "commonjs",
  entryPoints: {
    "./main.js": "jsenv_eslint_import_resolver.cjs",
  },
  preservedUrls: {
    // By default commonjs builds preserves all import to node_modules/*
    // but here we want to ensure @jsenv/* files are inlined during the build so that
    // "jsenv_importmap_eslint_resolver.cjs" do not try to require files containing import/export
    // that whould throw "require() of ES modules is not supported"
    "./node_modules/@jsenv/": false,
  },
  runtimeSupport: {
    node: "14.7.0",
  },
  buildDirectoryClean: true,
})
