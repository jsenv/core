import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"

import { collectHotDataFromHtmlAst } from "./helpers/html_hot_dependencies.js"
import { babelPluginMetadataImportMetaHot } from "./helpers/babel_plugin_metadata_import_meta_hot.js"

export const jsenvPluginHot = () => {
  const eventSourceClientFileUrl = new URL(
    "./client/event_source_client.js",
    import.meta.url,
  ).href
  const importMetaHotClientFileUrl = new URL(
    "./client/import_meta_hot.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:hot",
    appliesDuring: { dev: true },
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content)
        const { hotReferences } = collectHotDataFromHtmlAst(htmlAst)
        htmlUrlInfo.data.hotDecline = false
        htmlUrlInfo.data.hotAcceptSelf = false
        htmlUrlInfo.data.hotAcceptDependencies = hotReferences.map(
          ({ type, specifier }) => {
            const [reference] = context.referenceUtils.found({
              type,
              specifier,
            })
            return reference.url
          },
        )
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
            "injected-by": "jsenv:hot",
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
      css: (cssUrlInfo) => {
        cssUrlInfo.data.hotDecline = false
        cssUrlInfo.data.hotAcceptSelf = false
        cssUrlInfo.data.hotAcceptDependencies = []
      },
      js_module: async (urlInfo, context) => {
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          urlInfo,
        })
        const {
          importMetaHotDetected,
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies,
        } = metadata
        urlInfo.data.hotDecline = hotDecline
        urlInfo.data.hotAcceptSelf = hotAcceptSelf
        urlInfo.data.hotAcceptDependencies = hotAcceptDependencies
        if (!importMetaHotDetected) {
          return null
        }
        // For some reason using magic source here produce
        // better sourcemap than doing the equivalent with babel
        // I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
        // which is likely not well supported by babel
        const [importMetaHotClientFileReference] =
          context.referenceUtils.inject({
            parentUrl: urlInfo.url,
            type: "js_import_export",
            expectedType: "js_module",
            specifier: importMetaHotClientFileUrl,
          })
        const magicSource = createMagicSource(urlInfo.content)
        magicSource.prepend(
          `import { createImportMetaHot } from ${importMetaHotClientFileReference.generatedSpecifier}
  import.meta.hot = createImportMetaHot(import.meta.url)
  `,
        )
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}
