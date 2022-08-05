import { createUrlGraphLoader } from "@jsenv/core/src/omega/url_graph/url_graph_loader.js"
import { bundleJsModules } from "@jsenv/core/src/plugins/bundling/js_module/bundle_js_modules.js"

import { convertJsModuleToJsClassic } from "./convert_js_module_to_js_classic.js"

export const jsenvPluginAsJsClassicLibrary = ({
  systemJsInjection,
  systemJsClientFileUrl,
}) => {
  return {
    name: "jsenv:as_js_classic_library",
    // I think it applies both during dev and build
    // otherwise it's strange
    // we'll see as we tests
    appliesDuring: "*",
    redirectUrl: (reference) => {
      const urlObject = new URL(reference.url)
      if (urlObject.searchParams.has("as_js_classic_library")) {
        urlObject.searchParams.delete("as_js_classic_library")
        reference.urlInfoUrl = urlObject.href
        if (
          reference.type === "script_src" ||
          (reference.type === "js_url_specifier" &&
            reference.subtype !== "system_import_arg") ||
          (reference.type === "js_import_export" &&
            reference.subtype !== "import_dynamic")
        ) {
          reference.isEntryPoint = true
        }
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
      // TODO: likely needs to "clean after cook":
      // delete url info from graph to avoid having it generated in build directory?

      const loader = createUrlGraphLoader(context)
      loader.loadReferencedUrlInfos(jsModuleUrlInfo, {
        // for dynamic import we ignore them yes
        // but we must set something so that when they will be cooked
        // they inherit as_js_classic_library behaviour
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
          preserveDynamicImport: true,
        },
      })
      const jsModuleBundledUrlInfo = bundleUrlInfos[jsModuleUrlInfo.url]
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
        originalUrl: jsModuleBundledUrlInfo.originalUrl,
        originalContent: jsModuleBundledUrlInfo.originalContent,
        sourcemap,
      }
      // TODO: ensure urlInfo contains all js modules in dependences
      // so that is gets properly invalidated when a js module source file changes
    },
  }
}
