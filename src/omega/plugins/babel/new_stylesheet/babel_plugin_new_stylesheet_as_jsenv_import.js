/*
 * TODO:
 * - code should also inject helper when code uses new keyword on "CSSStyleSheet"
 * - code should also inject helper when code uses "document.adoptedStylesheets"
 */

import { pathToFileURL } from "node:url"

import { injectImport } from "@jsenv/utils/js_ast/babel_utils.js"

export const babelPluginNewStylesheetAsJsenvImport = (
  babel,
  { getImportSpecifier },
) => {
  const newStylesheetClientFileUrl = new URL(
    "./client/new_stylesheet.js",
    import.meta.url,
  ).href

  return {
    name: "new-stylesheet-as-jsenv-import",
    visitor: {
      Program: (programPath, { filename }) => {
        const fileUrl = pathToFileURL(filename).href
        if (fileUrl === newStylesheetClientFileUrl) {
          return
        }
        let needsNewStylesheetPolyfill = false
        programPath.traverse({
          CallExpression: (path) => {
            if (needsNewStylesheetPolyfill) {
              return
            }
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
            const sourcePath = path.get("arguments")[0]
            needsNewStylesheetPolyfill =
              hasCssModuleQueryParam(sourcePath) ||
              hasImportTypeCssAssertion(path)
          },
          ImportDeclaration: (path) => {
            if (needsNewStylesheetPolyfill) {
              return
            }
            const sourcePath = path.get("source")
            needsNewStylesheetPolyfill =
              hasCssModuleQueryParam(sourcePath) ||
              hasImportTypeCssAssertion(path)
          },
          ExportAllDeclaration: (path) => {
            if (needsNewStylesheetPolyfill) {
              return
            }
            const sourcePath = path.get("source")
            needsNewStylesheetPolyfill = hasCssModuleQueryParam(sourcePath)
          },
          ExportNamedDeclaration: (path) => {
            if (needsNewStylesheetPolyfill) {
              return
            }
            if (!path.node.source) {
              // This export has no "source", so it's probably
              // a local variable or function, e.g.
              // export { varName }
              // export const constName = ...
              // export function funcName() {}
              return
            }
            const sourcePath = path.get("source")
            needsNewStylesheetPolyfill = hasCssModuleQueryParam(sourcePath)
          },
        })
        if (needsNewStylesheetPolyfill) {
          injectImport({
            programPath,
            from: getImportSpecifier(newStylesheetClientFileUrl),
            sideEffect: true,
          })
        }
      },
    },
  }
}

const hasCssModuleQueryParam = (path) => {
  const { node } = path
  return (
    node.type === "StringLiteral" &&
    new URL(node.value, "https://jsenv.dev").searchParams.has(`css_module`)
  )
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
