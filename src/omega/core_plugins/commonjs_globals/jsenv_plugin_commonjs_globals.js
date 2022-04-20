/*
 * Some code uses globals specific to Node.js in code meant to run in browsers...
 * This plugin will replace some node globals to things compatible with web:
 * - process.env.NODE_ENV
 * - __filename
 * - __dirname
 * - global
 */

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

export const jsenvPluginCommonJsGlobals = () => {
  const transformCommonJsGlobals = async (urlInfo, { scenario }) => {
    const replaceMap = {
      "process.env.NODE_ENV": `("${
        scenario === "dev" || scenario === "test" ? "dev" : "prod"
      }")`,
      "global": "globalThis",
      "__filename": `import.meta.url.slice('file:///'.length)`,
      "__dirname": `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`,
    }
    const { metadata } = await applyBabelPlugins({
      babelPlugins: [
        [
          babelPluginMetadataExpressionPaths,
          {
            replaceMap,
            allowConflictingReplacements: true,
          },
        ],
      ],
      urlInfo,
    })
    const { expressionPaths } = metadata
    const keys = Object.keys(expressionPaths)
    if (keys.length === 0) {
      return null
    }
    const magicSource = createMagicSource(urlInfo.content)
    keys.forEach((key) => {
      expressionPaths[key].forEach((path) => {
        magicSource.replace({
          start: path.node.start,
          end: path.node.end,
          replacement: replaceMap[key],
        })
      })
    })
    return magicSource.toContentAndSourcemap()
  }

  return {
    name: "jsenv:commonjs_globals",
    appliesDuring: "*",
    transform: {
      js_classic: transformCommonJsGlobals,
      js_module: transformCommonJsGlobals,
    },
  }
}

// heavily inspired from https://github.com/jviide/babel-plugin-transform-replace-expressions
// last known commit: 57b608e0eeb8807db53d1c68292621dfafb5599c
const babelPluginMetadataExpressionPaths = (
  babel,
  { replaceMap = {}, allowConflictingReplacements = false },
) => {
  const { traverse, parse, types } = babel
  const replacementMap = new Map()
  const valueExpressionSet = new Set()

  return {
    name: "metadata-replace",

    pre: (state) => {
      // https://github.com/babel/babel/blob/d50e78d45b608f6e0f6cc33aeb22f5db5027b153/packages/babel-traverse/src/path/replacement.js#L93
      const parseExpression = (value) => {
        const expressionNode = parse(value, state.opts).program.body[0]
          .expression
        traverse.removeProperties(expressionNode)
        return expressionNode
      }
      Object.keys(replaceMap).forEach((key) => {
        const keyExpressionNode = parseExpression(key)
        const candidateArray = replacementMap.get(keyExpressionNode.type) || []
        const value = replaceMap[key]
        const valueExpressionNode = parseExpression(value)
        const equivalentKeyExpressionIndex = candidateArray.findIndex(
          (candidate) =>
            types.isNodesEquivalent(
              candidate.keyExpressionNode,
              keyExpressionNode,
            ),
        )
        if (
          !allowConflictingReplacements &&
          equivalentKeyExpressionIndex > -1
        ) {
          throw new Error(
            `Expressions ${candidateArray[equivalentKeyExpressionIndex].key} and ${key} conflict`,
          )
        }
        const newCandidate = {
          key,
          value,
          keyExpressionNode,
          valueExpressionNode,
        }
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
      Program: (programPath, state) => {
        const expressionPaths = {}
        programPath.traverse({
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
              return types.isNodesEquivalent(
                candidate.keyExpressionNode,
                path.node,
              )
            })
            if (candidateFound) {
              try {
                types.validate(
                  path.parent,
                  path.key,
                  candidateFound.valueExpressionNode,
                )
              } catch (err) {
                if (err instanceof TypeError) {
                  path.skip()
                  return
                }
                throw err
              }
              const paths = expressionPaths[candidateFound.key]
              if (paths) {
                expressionPaths[candidateFound.key] = [...paths, path]
              } else {
                expressionPaths[candidateFound.key] = [path]
              }
              return
            }
          },
        })
        state.file.metadata.expressionPaths = expressionPaths
      },
    },
  }
}
