import { require } from "../require.js"

export const babelPluginNewStylesheetAsJsenvImport = (
  api,
  {
    newStylesheetImportPath = "@jsenv/core/helpers/new_stylesheet/new_stylesheet.js",
  },
) => {
  api.assertVersion(7)

  const injectConstructableStylesheetPolyfill = ({ path, filename }) => {
    const filepathname = filename.replace(/\\/g, "/")
    if (filepathname.endsWith("/helpers/new_stylesheet/new_stylesheet.js")) {
      return
    }

    const { addSideEffect } = require("@babel/helper-module-imports")
    addSideEffect(path.scope.getProgramParent().path, newStylesheetImportPath)
  }

  // TODO: we should detect usage of new keyword on "CSSStyleSheet"
  // and inject too in that case
  return {
    name: "constructable-stylesheet-as-jsenv-import",
    visitor: {
      CallExpression: (path, { filename }) => {
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

        if (!hasImportTypeCssAssertion(path)) {
          return
        }

        injectConstructableStylesheetPolyfill({
          path,
          filename,
        })
      },

      ExportAllDeclaration: (path, { filename }) => {
        if (!hasImportTypeCssAssertion(path)) {
          return
        }
        injectConstructableStylesheetPolyfill({
          path,
          filename,
        })
      },

      ExportNamedDeclaration: (path, { filename }) => {
        if (!path.node.source) {
          // This export has no "source", so it's probably
          // a local variable or function, e.g.
          // export { varName }
          // export const constName = ...
          // export function funcName() {}
          return
        }

        if (!hasImportTypeCssAssertion(path)) {
          return
        }

        injectConstructableStylesheetPolyfill({
          path,
          filename,
        })
      },

      ImportDeclaration: (path, { filename }) => {
        if (!hasImportTypeCssAssertion(path)) {
          return
        }

        injectConstructableStylesheetPolyfill({
          path,
          filename,
        })
      },
    },
  }
}

const hasImportTypeCssAssertion = (path) => {
  const importAssertionsDescriptor = getImportAssertionsDescriptor(
    path.assertions,
  )
  return Boolean(importAssertionsDescriptor.type === "css")
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
