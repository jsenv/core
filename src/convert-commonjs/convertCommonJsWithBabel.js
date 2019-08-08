import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { transpiler } from "../compiled-js-service/transpiler.js"
import { createInlineProcessNodeEnvBabelPlugin } from "./createInlineProcessNodeEnvBabelPlugin.js"
import { createReplaceIdentifiersBabelPlugin } from "./createReplaceIdentifiersBabelPlugin.js"

const transformCommonJs = import.meta.require("babel-plugin-transform-commonjs")

export const convertCommonJsWithBabel = async ({
  projectPathname,
  sourceRelativePath,
  source,
  inlineNodeEnv = true,
  nodeEnv = process.env.NODE_ENV,
  replaceGlobalByGlobalThis = false,
}) => {
  const result = await transpiler({
    input: source,
    filename: pathnameToOperatingSystemPath(`${projectPathname}${sourceRelativePath}`),
    filenameRelative: sourceRelativePath.slice(1),
    babelPluginMap: {
      "transform-commonjs": [transformCommonJs],
      ...(inlineNodeEnv
        ? {
            "transform-node-env-inline": [
              createInlineProcessNodeEnvBabelPlugin({ value: nodeEnv }),
            ],
          }
        : {}),
      ...(replaceGlobalByGlobalThis
        ? {
            "replace-identifiers": [
              createReplaceIdentifiersBabelPlugin(),
              { global: "globalThis" },
            ],
          }
        : {}),
    },
    transformModuleIntoSystemFormat: false,
  })
  return result
}
