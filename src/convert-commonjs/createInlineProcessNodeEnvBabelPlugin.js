export const createInlineProcessNodeEnvBabelPlugin = ({ value = process.env.NODE_ENV }) => {
  return ({ types: t }) => {
    return {
      name: "inline-process-node-env",
      visitor: {
        MemberExpression(path) {
          if (path.matchesPattern("process.env.NODE_ENV")) {
            path.replaceWith(t.valueToNode(value))

            if (path.parentPath.isBinaryExpression()) {
              const evaluated = path.parentPath.evaluate()
              if (evaluated.confident) {
                path.parentPath.replaceWith(t.valueToNode(evaluated.value))
              }
            }
          }
        },
      },
    }
  }
}
