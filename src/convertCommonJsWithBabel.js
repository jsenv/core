import { require } from "./internal/require.js"
import { transformJs } from "./internal/compiling/js-compilation-service/transformJs.js"

const transformCommonJs = require("babel-plugin-transform-commonjs")

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
  // maybe we should use babel core here instead of transformJs
  const result = await transformJs({
    projectDirectoryUrl,
    code,
    url,
    babelPluginMap: {
      "transform-commonjs": [transformCommonJs],
      "transform-replace-expressions": [
        createReplaceExpressionsBabelPlugin({
          replaceMap: {
            ...(replaceProcessEnvNodeEnv
              ? { "process.env.NODE_ENV": `("${processEnvNodeEnv}")` }
              : {}),
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

// heavily inspired from https://github.com/jviide/babel-plugin-transform-replace-expressions

const createReplaceExpressionsBabelPlugin = ({
  replaceMap = {},
  allowConflictingReplacements = false,
} = {}) => {
  const replacementMap = new Map()
  const valueExpressionSet = new Set()
  return ({ traverse, parse, types }) => {
    return {
      name: "replace-expressions",
      pre: (state) => {
        // https://github.com/babel/babel/blob/d50e78d45b608f6e0f6cc33aeb22f5db5027b153/packages/babel-traverse/src/path/replacement.js#L93
        const parseExpression = (value) => {
          const expressionNode = parse(value, state.opts).program.body[0].expression
          traverse.removeProperties(expressionNode)
          return expressionNode
        }

        Object.keys(replaceMap).forEach((key) => {
          const keyExpressionNode = parseExpression(key)
          const candidateArray = replacementMap.get(keyExpressionNode.type) || []
          const value = replaceMap[key]
          const valueExpressionNode = parseExpression(value)

          const equivalentKeyExpressionIndex = candidateArray.findIndex((candidate) =>
            types.isNodesEquivalent(candidate.keyExpressionNode, keyExpressionNode),
          )
          if (!allowConflictingReplacements && equivalentKeyExpressionIndex > -1) {
            throw new Error(
              `Expressions ${candidateArray[equivalentKeyExpressionIndex].key} and ${key} conflict`,
            )
          }

          const newCandidate = { key, value, keyExpressionNode, valueExpressionNode }
          if (equivalentKeyExpressionIndex > -1) {
            candidateArray[equivalentKeyExpressionIndex] = newCandidate
          } else {
            candidateArray.push(newCandidate)
          }
          replacementMap.set(keyExpressionNode.type, candidateArray)
        })

        replacementMap.forEach((candidateArray) => {
          candidateArray.forEach((candidate) => {
            valueExpressionSet.add(candidate.valueExpressionNode)
          })
        })
      },
      visitor: {
        Expression(path) {
          if (valueExpressionSet.has(path.node)) {
            path.skip()
            return
          }

          const candidateArray = replacementMap.get(path.node.type)
          if (!candidateArray) {
            return
          }

          const candidateFound = candidateArray.find((candidate) => {
            return types.isNodesEquivalent(candidate.keyExpressionNode, path.node)
          })
          if (candidateFound) {
            try {
              types.validate(path.parent, path.key, candidateFound.valueExpressionNode)
            } catch (err) {
              if (!(err instanceof TypeError)) {
                throw err
              }
              path.skip()
              return
            }

            path.replaceWith(candidateFound.valueExpressionNode)
            return
          }
        },
      },
    }
  }
}
