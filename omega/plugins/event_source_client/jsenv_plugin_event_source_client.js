import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { urlToRelativeUrl } from "@jsenv/filesystem"

export const jsenvPluginEventSourceClient = () => {
  return {
    name: "jsenv:event_source_client",

    appliesDuring: {
      dev: true,
      test: false,
      preview: false,
      build: false,
    },

    transform: ({ projectDirectoryUrl, contentType, content }) => {
      if (contentType !== "text/html") {
        return null
      }
      const htmlAst = parseHtmlString(content)
      const eventSourceFileUrl = new URL(
        "./src/internal/event_source_client/event_source_client.js",
        jsenvCoreDirectoryUrl,
      )
      injectScriptAsEarlyAsPossible(
        htmlAst,
        createHtmlNode({
          tagName: "script",
          type: "module",
          src: urlToRelativeUrl(eventSourceFileUrl, projectDirectoryUrl),
        }),
      )
      const htmlModified = stringifyHtmlAst(htmlAst)
      return {
        content: htmlModified,
      }
    },
  }
}
