import {
  resolveUrl,
  fileSystemPathToUrl,
  urlIsInsideOf,
} from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const regeneratorRuntimeHelperDirectoryUrl = resolveUrl(
  "./helpers/regenerator-runtime/",
  jsenvCoreDirectoryUrl,
)

export const ensureRegeneratorRuntimeImportBabelPlugin = (api, options) => {
  const { addSideEffect } = require("@babel/helper-module-imports")

  api.assertVersion(7)

  const {
    regeneratorRuntimeIdentifierName = "regeneratorRuntime",
    regeneratorRuntimeImportPath = "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js",
  } = options

  return {
    visitor: {
      Identifier(path, opts) {
        const { filename } = opts
        if (
          urlIsInsideOf(
            fileSystemPathToUrl(filename),
            regeneratorRuntimeHelperDirectoryUrl,
          )
        ) {
          return
        }

        const { node } = path
        if (node.name === regeneratorRuntimeIdentifierName) {
          addSideEffect(
            path.scope.getProgramParent().path,
            regeneratorRuntimeImportPath,
          )
        }
      },
    },
  }
}
