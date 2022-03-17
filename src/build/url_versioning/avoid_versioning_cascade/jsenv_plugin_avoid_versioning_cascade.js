// https://bundlers.tooling.report/hashing/avoid-cascade/

import {
  parseHtmlString,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"

export const jsenvPluginAvoidVersioningCascade = () => {
  const clientFileUrl = new URL(
    "./client/versioned_resolver.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:avoid_versioning_cascade",
    appliesDuring: { build: true },
    transform: {
      html: ({ content }, { addReference }) => {
        const htmlAst = parseHtmlString(content)
        const clientFileReference = addReference({
          type: "js_import_export",
          specifier: clientFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            src: clientFileReference.generatedSpecifier,
          }),
        )
        return stringifyHtmlAst(htmlAst)
      },
    },
  }
}
