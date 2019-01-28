// https://github.com/rollup/rollup-plugin-node-resolve/blob/master/src/index.js

import { resolveImport } from "@jsenv/module-resolution"

export const createJsenvResolvePlugin = ({ root } = {}) => {
  return {
    name: "jsenv-resolve",

    resolveId(importee, importer) {
      if (!importer) return importee
      return resolveImport({
        moduleSpecifier: importee,
        file: importer,
        root,
        useNodeModuleResolutionInsideDedicatedFolder: true,
      })
    },
  }
}
