import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { transpiler } from "../compiled-js-service/transpiler.js"
import { createReplaceExpressionsBabelPlugin } from "./createReplaceExpressionsBabelPlugin.js"

const transformCommonJs = import.meta.require("babel-plugin-transform-commonjs")

export const convertCommonJsWithBabel = async ({
  projectPathname,
  sourceRelativePath,
  source,
  replaceGlobalObject = true,
  replaceGlobalFilename = true,
  replaceGlobalDirname = true,
  replaceProcessEnvNodeEnv = true,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceMap = {},
}) => {
  const result = await transpiler({
    input: source,
    filename: pathnameToOperatingSystemPath(`${projectPathname}${sourceRelativePath}`),
    filenameRelative: sourceRelativePath.slice(1),
    babelPluginMap: {
      "transform-commonjs": [transformCommonJs],
      "transform-replace-expressions": [
        createReplaceExpressionsBabelPlugin({
          replaceMap: {
            ...(replaceProcessEnvNodeEnv ? { "process.env.NODE_ENV": processEnvNodeEnv } : {}),
            ...(replaceGlobalObject ? { global: "globalThis" } : {}),
            ...(replaceGlobalFilename ? { __filename: __filenameReplacement } : {}),
            ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
            ...replaceMap,
          },
        }),
      ],
    },
    transformModuleIntoSystemFormat: false,
  })
  return result
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
