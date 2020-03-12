import { generateCommonJsBundleForNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

generateCommonJsBundleForNode({
  ...jsenvConfig,
  bundleDirectoryClean: true,
  externalImportSpecifiers: [
    "rollup",
    "@jsenv/cancellation",
    "@jsenv/import-map",
    "@jsenv/logger",
    "@jsenv/node-module-import-map",
    "@jsenv/node-signals",
    "@jsenv/server",
    "@jsenv/uneval",
    "@jsenv/util",
  ],
})
