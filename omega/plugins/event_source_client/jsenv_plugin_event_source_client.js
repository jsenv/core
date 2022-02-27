import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

export const jsenvPluginEventSourceClient = () => {
  return {
    name: "jsenv:event_source_client",

    appliesDuring: {
      dev: true,
      test: false,
      preview: false,
      build: false,
    },

    transform: ({ contentType, content }) => {
      if (contentType !== "text/html") {
        return null
      }
      const htmlAst = parseHtmlString(content)
      injectScriptAsEarlyAsPossible(
        htmlAst,
        createHtmlNode({
          tagName: "script",
          type: "module",
          src: "@jsenv/core/src/internal/event_source_client/event_source_client.js",
        }),
      )
      const htmlModified = stringifyHtmlAst(htmlAst)
      return {
        content: htmlModified,
      }
    },
  }
}
