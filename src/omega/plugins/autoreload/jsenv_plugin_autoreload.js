import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"

import { babelPluginImportMetaHot } from "./babel_plugin_import_meta_hot.js"

export const jsenvPluginAutoreload = () => {
  const eventSourceFileUrl = new URL(
    "./client/event_source_client.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:autoreload",
    appliesDuring: {
      dev: true,
    },
    transform: {
      html: async ({
        projectDirectoryUrl,
        resolve,
        asClientUrl,
        url,
        content,
      }) => {
        const htmlAst = parseHtmlString(content)
        const eventSourceResolvedUrl = await resolve({
          parentUrl: String(projectDirectoryUrl),
          specifierType: "js_import_export",
          specifier: eventSourceFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "src": asClientUrl(eventSourceResolvedUrl, url),
            "data-injected": true,
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
      js_module: async ({ url, content }) => {
        const { code, map } = await applyBabelPlugins({
          babelPlugins: [babelPluginImportMetaHot],
          url,
          content,
        })
        return {
          content: code,
          sourcemap: map,
        }
      },
    },
  }
}
