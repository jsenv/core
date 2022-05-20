import { urlIsInsideOf } from "@jsenv/filesystem"

import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"
import { jsenvRootDirectoryUrl } from "@jsenv/core/src/jsenv_root_directory_url.js"

export const jsenvPluginDevSSEClient = ({ rootDirectoryUrl }) => {
  const preferSourceFiles =
    rootDirectoryUrl === jsenvRootDirectoryUrl ||
    urlIsInsideOf(rootDirectoryUrl, jsenvRootDirectoryUrl)
  const eventSourceClientFileUrl = preferSourceFiles
    ? new URL("./client/event_source_client.js", import.meta.url).href
    : new URL("./dist/event_source_client.js", jsenvRootDirectoryUrl).href

  return {
    name: "jsenv:dev_sse_client",
    appliesDuring: { dev: true },
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content)
        const [eventSourceClientReference] = context.referenceUtils.inject({
          type: "script_src",
          expectedType: "js_module",
          specifier: eventSourceClientFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "src": eventSourceClientReference.generatedSpecifier,
            "injected-by": "jsenv:dev_sse_client",
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
}
