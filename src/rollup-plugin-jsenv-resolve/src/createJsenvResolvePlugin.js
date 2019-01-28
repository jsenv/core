// https://github.com/rollup/rollup-plugin-node-resolve/blob/master/src/index.js

import { resolveImport } from "@jsenv/module-resolution"

export const createJsenvResolvePlugin = (/*options = {} */) => {
  return {
    name: "jsenv-resolve",

    resolveId(importee, importer) {
      return resolveImport({
        moduleSpecifier: importee,
        file: importer,
        useNodeModuleResolutionInsideDedicatedFolder: true,
      })
    },
  }
}
