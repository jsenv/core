import { readFileSync } from "node:fs"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

export const babelPluginSystemJsPrepend = (api) => {
  api.assertVersion(7)
  const systemJsUrl = new URL(
    "src/internal/runtime/s.js",
    jsenvCoreDirectoryUrl,
  )
  return {
    name: "systemjs-prepend",
    visitor: {
      Program: {
        exit(path) {
          const code = String(readFileSync(systemJsUrl))
          const ast = api.template.ast`${code}`
          path.node.body.unshift(ast)
        },
      },
    },
  }
}
