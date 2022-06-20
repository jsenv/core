import { createMagicSource } from "@jsenv/sourcemap"
import { parseHtmlString } from "@jsenv/utils/src/html_ast/html_ast.js"
import { applyBabelPlugins } from "@jsenv/utils/src/js_ast/apply_babel_plugins.js"

import { collectHotDataFromHtmlAst } from "./html_hot_dependencies.js"
import { babelPluginMetadataImportMetaHot } from "./babel_plugin_metadata_import_meta_hot.js"

export const jsenvPluginImportMetaHot = () => {
  const importMetaHotClientFileUrl = new URL(
    "./client/import_meta_hot.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:import_meta_hot",
    appliesDuring: "*",
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        // during build we don't really care to parse html hot dependencies
        if (context.scenario === "build") {
          return
        }
        const htmlAst = parseHtmlString(htmlUrlInfo.content)
        const hotReferences = collectHotDataFromHtmlAst(htmlAst)
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
      },
      css: (cssUrlInfo) => {
        cssUrlInfo.data.hotDecline = false
        cssUrlInfo.data.hotAcceptSelf = false
        cssUrlInfo.data.hotAcceptDependencies = []
      },
      js_module: async (urlInfo, context) => {
        if (!urlInfo.content.includes("import.meta.hot")) {
          return null
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          urlInfo,
        })
        const {
          importMetaHotPaths,
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies,
        } = metadata
        urlInfo.data.hotDecline = hotDecline
        urlInfo.data.hotAcceptSelf = hotAcceptSelf
        urlInfo.data.hotAcceptDependencies = hotAcceptDependencies
        if (importMetaHotPaths.length === 0) {
          return null
        }
        if (context.scenario === "build") {
          return removeImportMetaHots(urlInfo, importMetaHotPaths)
        }
        return injectImportMetaHot(urlInfo, context, importMetaHotClientFileUrl)
      },
    },
  }
}

const removeImportMetaHots = (urlInfo, importMetaHotPaths) => {
  const magicSource = createMagicSource(urlInfo.content)
  importMetaHotPaths.forEach((path) => {
    magicSource.replace({
      start: path.node.start,
      end: path.node.end,
      replacement: "undefined",
    })
  })
  return magicSource.toContentAndSourcemap()
}

// For some reason using magic source here produce
// better sourcemap than doing the equivalent with babel
// I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
// which is likely not well supported by babel
const injectImportMetaHot = (urlInfo, context, importMetaHotClientFileUrl) => {
  const [importMetaHotClientFileReference] = context.referenceUtils.inject({
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
}
