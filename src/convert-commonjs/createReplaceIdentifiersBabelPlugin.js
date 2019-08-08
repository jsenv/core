export const createReplaceIdentifiersBabelPlugin = () => {
  return ({ types: t }) => {
    return {
      name: "replace-identifiers",
      visitor: {
        Identifier(path, state) {
          const newId = state.opts.hasOwnProperty(path.node.name) && state.opts[path.node.name]
          if (newId) {
            path.replaceWith(t.identifier(newId))
          }
        },
      },
    }
  }
}
