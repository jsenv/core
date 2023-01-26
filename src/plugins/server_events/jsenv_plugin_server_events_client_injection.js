/*
 * This plugin is very special because it is here
 * to provide "serverEvents" used by other plugins
 */

import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast"

const serverEventsClientFileUrl = new URL(
  "./client/server_events_client.js",
  import.meta.url,
).href

export const jsenvPluginServerEventsClientInjection = () => {
  return {
    name: "jsenv:server_events_client_injection",
    appliesDuring: "*",
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content)
        const [serverEventsClientFileReference] = context.referenceUtils.inject(
          {
            type: "script",
            subtype: "js_module",
            expectedType: "js_module",
            specifier: serverEventsClientFileUrl,
          },
        )
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            src: serverEventsClientFileReference.generatedSpecifier,
          }),
          "jsenv:server_events",
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
}
