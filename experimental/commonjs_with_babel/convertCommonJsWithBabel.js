import { require } from "@jsenv/core/src/internal/require.js"
import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import { babelPluginReplaceExpressions } from "@jsenv/core/src/internal/babel-plugin-replace-expressions.js"
import { transformResultToCompilationResult } from "@jsenv/core/src/internal/compiling/transformResultToCompilationResult.js"

export const convertCommonJsWithBabel = async ({
  code,
  map,
  url,
  compiledUrl,
  projectDirectoryUrl,

  sourcemapExcludeSources,

  replaceGlobalObject = true,
  replaceGlobalFilename = true,
  replaceGlobalDirname = true,
  replaceProcessEnvNodeEnv = true,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceMap = {},
}) => {
  // eslint-disable-next-line import/no-unresolved
  const transformCommonJs = require("babel-plugin-transform-commonjs")

  const transformResult = await transformJs({
    code,
    map,
    url,
    projectDirectoryUrl,

    babelPluginMap: {
      "transform-commonjs": [transformCommonJs],
      "transform-replace-expressions": [
        babelPluginReplaceExpressions,
        {
          replaceMap: {
            ...(replaceProcessEnvNodeEnv
              ? { "process.env.NODE_ENV": `("${processEnvNodeEnv}")` }
              : {}),
            ...(replaceGlobalObject ? { global: "globalThis" } : {}),
            ...(replaceGlobalFilename
              ? { __filename: __filenameReplacement }
              : {}),
            ...(replaceGlobalDirname
              ? { __dirname: __dirnameReplacement }
              : {}),
            ...replaceMap,
          },
        },
      ],
    },
  })

  return transformResultToCompilationResult(
    {
      contentType: "application/javascript",
      code: transformResult.code,
      map: transformResult.map,
    },
    {
      projectDirectoryUrl,
      originalFileContent: code,
      originalFileUrl: url,
      compiledFileUrl: compiledUrl,
      sourcemapFileUrl: `${compiledUrl}.map`,
      sourcemapExcludeSources,
    },
  )
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`

// const createInlineProcessNodeEnvBabelPlugin = ({ value = process.env.NODE_ENV }) => {
//   return ({ types: t }) => {
//     return {
//       name: "inline-process-node-env",
//       visitor: {
//         MemberExpression(path) {
//           if (path.matchesPattern("process.env.NODE_ENV")) {
//             path.replaceWith(t.valueToNode(value))

//             if (path.parentPath.isBinaryExpression()) {
//               const evaluated = path.parentPath.evaluate()
//               if (evaluated.confident) {
//                 path.parentPath.replaceWith(t.valueToNode(evaluated.value))
//               }
//             }
//           }
//         },
//       },
//     }
//   }
// }
