// https://bundlers.tooling.report/hashing/avoid-cascade/

import {
  parseHtmlString,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/core/old_src/internal/transform_html/html_ast.js"

export const jsenvPluginAvoidVersioningCascade = () => {
  const clientFileUrl = new URL("./client/versioned_url_resolver.js").href

  return {
    name: "jsenv:avoid_versioning_cascade",
    appliesDuring: { preview: true, prod: true },
    transform: {
      html: ({ resolveSpecifier, asClientUrl, url, content }) => {
        const htmlAst = parseHtmlString(content)
        const clientFileUrlResolved = resolveSpecifier({
          parentUrl: url,
          specifierType: "js_import_export",
          specifier: clientFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            type: "script",
            src: asClientUrl(clientFileUrlResolved),
          }),
        )
        return stringifyHtmlAst(htmlAst)
      },
    },
  }
}
