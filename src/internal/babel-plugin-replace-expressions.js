// heavily inspired from https://github.com/jviide/babel-plugin-transform-replace-expressions
// last known commit: 57b608e0eeb8807db53d1c68292621dfafb5599c

export const createReplaceExpressionsBabelPlugin = ({
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
