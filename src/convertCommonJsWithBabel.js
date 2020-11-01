import { require } from "./internal/require.js"
import { transformJs } from "./internal/compiling/js-compilation-service/transformJs.js"
import { babelPluginReplaceExpressions } from "./internal/babel-plugin-replace-expressions.js"

export const convertCommonJsWithBabel = async ({
  projectDirectoryUrl,
  code,
  url,
  replaceGlobalObject = true,
  replaceGlobalFilename = true,
  replaceGlobalDirname = true,
  replaceProcessEnvNodeEnv = true,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceMap = {},
}) => {
  const transformCommonJs = require("babel-plugin-transform-commonjs")

  // maybe we should use babel core here instead of transformJs
  const result = await transformJs({
    projectDirectoryUrl,
    code,
    url,
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
            ...(replaceGlobalFilename ? { __filename: __filenameReplacement } : {}),
            ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
            ...replaceMap,
          },
        },
      ],
    },
    transformModuleIntoSystemFormat: false,
  })
  return result
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
