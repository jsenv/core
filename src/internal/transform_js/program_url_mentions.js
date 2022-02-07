/*
 * Will be used either to put import specifier in metadata
 * or to transform import specifiers
 *
 * see also
 * https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md
 * https://github.com/mjackson/babel-plugin-import-visitor
 *
 */

export const collectProgramUrlMentions = (programPath) => {
  const urlMentions = []
  programPath.traverse({
    NewExpression: (path) => {
      if (isNewUrlImportMetaUrl(path.node)) {
        urlMentions.push({
          type: "url",
          specifierPath: path.get("arguments")[0],
          path,
        })
      }
    },
    CallExpression: (path) => {
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
      urlMentions.push({
        type: "import_export",
        specifierPath: path.get("arguments")[0],
        path,
      })
    },
    ExportAllDeclaration: (path) => {
      urlMentions.push({
        type: "import_export",
        specifierPath: path.get("source"),
        path,
      })
    },
    ExportNamedDeclaration: (path) => {
      if (!path.node.source) {
        // This export has no "source", so it's probably
        // a local variable or function, e.g.
        // export { varName }
        // export const constName = ...
        // export function funcName() {}
        return
      }
      urlMentions.push({
        type: "import_export",
        specifierPath: path.get("source"),
        path,
      })
    },
    ImportDeclaration: (path) => {
      urlMentions.push({
        type: "import_export",
        specifierPath: path.get("source"),
        path,
      })
    },
  })
  return urlMentions
}

const isNewUrlImportMetaUrl = (node) => {
  return (
    node.callee.type === "Identifier" &&
    node.callee.name === "URL" &&
    node.arguments.length === 2 &&
    node.arguments[0].type === "StringLiteral" &&
    node.arguments[1].type === "MemberExpression" &&
    node.arguments[1].object.type === "MetaProperty" &&
    node.arguments[1].property.type === "Identifier" &&
    node.arguments[1].property.name === "url"
  )
}
