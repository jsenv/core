/*
 * Not meant to be used directly
 * Will be used either to put import specifier in metadata
 * or to transform import specifiers
 *
 * see also
 * https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md
 * https://github.com/mjackson/babel-plugin-import-visitor
 *
 */

export const traverseProgramImports = (programPath, importVisitor) => {
  programPath.traverse({
    CallExpression: (path, state) => {
      if (path.node.callee.type !== "Import") {
        // Some other function call, not import();
        return
      }

      if (path.node.arguments[0].type !== "StringLiteral") {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return
      }

      importVisitor({
        importPath: path,
        specifierPath: path.get("arguments")[0],
        state,
      })
    },

    ExportAllDeclaration: (path, state) => {
      importVisitor({
        importPath: path,
        specifierPath: path.get("source"),
        state,
      })
    },

    ExportNamedDeclaration: (path, state) => {
      if (!path.node.source) {
        // This export has no "source", so it's probably
        // a local variable or function, e.g.
        // export { varName }
        // export const constName = ...
        // export function funcName() {}
        return
      }

      importVisitor({
        importPath: path,
        specifierPath: path.get("source"),
        state,
      })
    },

    ImportDeclaration: (path, state) => {
      importVisitor({
        importPath: path,
        specifierPath: path.get("source"),
        state,
      })
    },
  })
}
