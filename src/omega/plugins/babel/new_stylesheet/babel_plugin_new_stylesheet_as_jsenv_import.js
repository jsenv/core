/*
 * TODO:
 * - code should also inject helper when code uses new keyword on "CSSStyleSheet"
 * - code should also inject helper when code uses "document.adoptedStylesheets"
 */

import { pathToFileURL } from "node:url"

import { injectImport } from "@jsenv/core/src/utils/js_ast/babel_utils.js"

export const babelPluginNewStylesheetAsJsenvImport = () => {
  const newStylesheetClientFileUrl = new URL(
    "./client/new_stylesheet.js",
    import.meta.url,
  ).href

  const injectConstructableStylesheetPolyfill = ({ path, filename }) => {
    const fileUrl = pathToFileURL(filename).href
    if (fileUrl === newStylesheetClientFileUrl) {
      return
    }
    injectImport({
      programPath: path.scope.getProgramParent().path,
      from: newStylesheetClientFileUrl,
      sideEffect: true,
    })
  }
  return {
    name: "new-stylesheet-as-jsenv-import",
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
    path.node.assertions,
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
