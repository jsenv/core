// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md
// https://github.com/mjackson/babel-plugin-import-visitor

export const babelPluginTransformImportSpecifier = (
  babel,
  { transformImportSpecifier = ({ specifier }) => specifier } = {},
) => {
  return {
    name: "transform-import-specifier",

    // manipulateOptions(opts, parserOpts) {
    //   parserOpts.plugins.push(
    //     "dynamicImport",
    //     "exportDefaultFrom",
    //     "exportNamespaceFrom",
    //     "importMeta",
    //   )
    // },

    visitor: {
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

        transformStringLiteralAtPath(
          path.get("arguments")[0],
          transformImportSpecifier,
          babel,
        )
      },

      ExportAllDeclaration: (path) => {
        transformStringLiteralAtPath(
          path.get("source"),
          transformImportSpecifier,
          babel,
        )
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

        transformStringLiteralAtPath(
          path.get("source"),
          transformImportSpecifier,
          babel,
        )
      },

      ImportDeclaration: (path) => {
        transformStringLiteralAtPath(
          path.get("source"),
          transformImportSpecifier,
          babel,
        )
      },
    },
  }
}

const transformStringLiteralAtPath = (path, transform, babel) => {
  const value = path.node.value
  const valueTransformed = transform({
    specifier: value,
    node: path.node,
    assertionsDescriptor: getImportAssertionsDescriptor(path.parent.assertions),
  })
  if (valueTransformed !== value) {
    path.replaceWith(babel.types.stringLiteral(valueTransformed))
  }
}

const getImportAssertionsDescriptor = (importAssertions) => {
  const importAssertionsDescriptor = {}
  if (importAssertions) {
    importAssertions.forEach((importAssertion) => {
      importAssertionsDescriptor[importAssertion.key.name] =
        importAssertion.value.value
    })
  }
  return importAssertionsDescriptor
}
