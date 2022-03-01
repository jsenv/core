import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"

import { babelPluginImportMetaHot } from "./babel_plugin_import_meta_hot.js"

export const jsenvPluginAutoreload = () => {
  const transformers = {
    "text/html": async ({
      projectDirectoryUrl,
      resolve,
      asClientUrl,
      url,
      content,
    }) => {
      const htmlAst = parseHtmlString(content)
      const eventSourceFileUrl = await resolve({
        parentUrl: projectDirectoryUrl,
        specifierType: "js_import_export",
        specifier:
          "@jsenv/core/omega/plugins/autoreload/client/event_source_client.js",
      })
      injectScriptAsEarlyAsPossible(
        htmlAst,
        createHtmlNode({
          "tagName": "script",
          "type": "module",
          "src": asClientUrl(eventSourceFileUrl, url),
          "data-injected": true,
        }),
      )
      const htmlModified = stringifyHtmlAst(htmlAst)
      return {
        content: htmlModified,
      }
    },
    "application/javascript": async ({ url, content }) => {
      const { code, map } = await babelTransform({
        options: {
          plugins: [[babelPluginImportMetaHot]],
        },
        url,
        content,
      })
      return {
        content: code,
        sourcemap: map,
      }
    },
  }

  return {
    name: "jsenv:autoreload",
    appliesDuring: {
      dev: true,
      test: false,
      preview: false,
      prod: false,
    },

    transform: async ({
      projectDirectoryUrl,
      resolve,
      asClientUrl,
      url,
      contentType,
      content,
    }) => {
      const transformer = transformers[contentType]
      return transformer
        ? transformer({
            projectDirectoryUrl,
            resolve,
            asClientUrl,
            url,
            content,
          })
        : null
    },
  }
}
