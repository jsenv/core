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

    transform: async ({
      projectDirectoryUrl,
      resolve,
      asClientUrl,
      contentType,
      content,
    }) => {
      if (contentType !== "text/html") {
        return null
      }
      const htmlAst = parseHtmlString(content)
      const eventSourceFileUrl = await resolve({
        parentUrl: projectDirectoryUrl,
        specifierType: "js_import_export",
        specifier:
          "@jsenv/core/src/internal/event_source_client/event_source_client.js",
      })
      injectScriptAsEarlyAsPossible(
        htmlAst,
        createHtmlNode({
          tagName: "script",
          type: "module",
          src: asClientUrl(eventSourceFileUrl),
        }),
      )
      const htmlModified = stringifyHtmlAst(htmlAst)
      return {
        content: htmlModified,
      }
    },
  }
}
