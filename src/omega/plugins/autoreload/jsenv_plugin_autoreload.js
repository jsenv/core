import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"

import { babelPluginMetadataImportMetaHot } from "./babel_plugin_metadata_import_meta_hot.js"

export const jsenvPluginAutoreload = () => {
  const eventSourceFileUrl = new URL(
    "./client/event_source_client.js",
    import.meta.url,
  ).href
  const importMetaHotClientFileUrl = new URL(
    "./client/import_meta_hot_module.js",
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
        resolveSpecifier,
        asClientUrl,
        content,
      }) => {
        const htmlAst = parseHtmlString(content)
        const eventSourceResolvedUrl = resolveSpecifier({
          parentUrl: projectDirectoryUrl,
          specifierType: "js_import_export",
          specifier: eventSourceFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            src: asClientUrl(eventSourceResolvedUrl),
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
      js_module: async ({ parentUrlSite, url, content }) => {
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          parentUrlSite,
          url,
          content,
        })
        const { importMetaHotDetected } = metadata
        if (!importMetaHotDetected) {
          return null
        }
        // For some reason using magic source here produce
        // better sourcemap than doing the equivalent with babel
        // I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
        // which is likely not well supported by babel
        const magicSource = createMagicSource({
          url,
          content,
        })
        magicSource.prepend(
          `import { createImportMetaHot } from "${importMetaHotClientFileUrl}"
import.meta.hot = createImportMetaHot(import.meta.url)
`,
        )
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}
