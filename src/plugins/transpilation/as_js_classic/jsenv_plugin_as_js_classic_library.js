import { createUrlGraphLoader } from "@jsenv/core/src/omega/url_graph/url_graph_loader.js"
import { bundleJsModules } from "@jsenv/core/src/plugins/bundling/js_module/bundle_js_modules.js"

import { convertJsModuleToJsClassic } from "./convert_js_module_to_js_classic.js"

export const jsenvPluginAsJsClassicLibrary = ({
  systemJsInjection,
  systemJsClientFileUrl,
  generateJsClassicFilename,
}) => {
  const markAsJsClassicLibraryProxy = (reference) => {
    reference.expectedType = "js_classic"
    reference.filename = generateJsClassicFilename(reference.url)
  }

  return {
    name: "jsenv:as_js_classic_library",
    appliesDuring: "*",
    redirectUrl: (reference) => {
      if (reference.searchParams.has("as_js_classic_library")) {
        markAsJsClassicLibraryProxy(reference)
      }
    },
    fetchUrlContent: async (urlInfo, context) => {
      const [jsModuleReference, jsModuleUrlInfo] =
        context.getWithoutSearchParam({
          urlInfo,
          context,
          searchParam: "as_js_classic_library",
          // override the expectedType to "js_module"
          // because when there is ?as_js_classic_library it means the underlying resource
          // is a js_module
          expectedType: "js_module",
        })
      if (!jsModuleReference) {
        return null
      }
      // cook it to get content + dependencies
      await context.cook(jsModuleUrlInfo, { reference: jsModuleReference })
      const loader = createUrlGraphLoader(context)
      loader.loadReferencedUrlInfos(jsModuleUrlInfo, {
        // we ignore dynamic import to cook lazyly (as browser request the server)
        // these dynamic imports must inherit "?as_js_classic_library"
        // This is done inside rollup for convenience
        ignoreDynamicImport: true,
      })
      await loader.getAllLoadDonePromise()
      const bundleUrlInfos = await bundleJsModules({
        jsModuleUrlInfos: [jsModuleUrlInfo],
        context: {
          ...context,
          buildDirectoryUrl: context.outDirectoryUrl,
        },
        options: {
          babelHelpersChunk: false,
          preserveDynamicImport: true,
        },
      })
      const jsModuleBundledUrlInfo = bundleUrlInfos[jsModuleUrlInfo.url]
      if (context.scenarios.dev) {
        jsModuleBundledUrlInfo.sourceUrls.forEach((sourceUrl) => {
          context.referenceUtils.inject({
            type: "js_url_specifier",
            specifier: sourceUrl,
            isImplicit: true,
          })
        })
      } else if (context.scenarios.build) {
        jsModuleBundledUrlInfo.sourceUrls.forEach((sourceUrl) => {
          const sourceUrlInfo = context.urlGraph.getUrlInfo(sourceUrl)
          if (sourceUrlInfo.dependents.size === 0) {
            context.urlGraph.deleteUrlInfo(sourceUrl)
          }
        })
      }
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        systemJsInjection,
        systemJsClientFileUrl,
        urlInfo,
        jsModuleUrlInfo: jsModuleBundledUrlInfo,
      })
      return {
        content,
        contentType: "text/javascript",
        type: "js_classic",
        originalUrl: urlInfo.originalUrl,
        originalContent: jsModuleUrlInfo.originalContent,
        sourcemap,
      }
    },
  }
}
