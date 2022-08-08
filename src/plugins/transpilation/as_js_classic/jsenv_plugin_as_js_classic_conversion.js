import { injectQueryParams } from "@jsenv/urls"
import { convertJsModuleToJsClassic } from "./convert_js_module_to_js_classic.js"

// propagate ?as_js_classic to referenced urls
// and perform the conversion during fetchUrlContent
export const jsenvPluginAsJsClassicConversion = ({
  systemJsInjection,
  systemJsClientFileUrl,
  generateJsClassicFilename,
}) => {
  const propagateJsClassicSearchParam = (reference, context) => {
    const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
    if (
      !parentUrlInfo ||
      !new URL(parentUrlInfo.url).searchParams.has("as_js_classic")
    ) {
      return null
    }
    const urlTransformed = injectQueryParams(reference.url, {
      as_js_classic: "",
    })
    reference.filename = generateJsClassicFilename(reference.url)
    return urlTransformed
  }

  return {
    name: "jsenv:as_js_classic_conversion",
    appliesDuring: "*",
    redirectUrl: {
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline resources
      // or specifiers inside new URL()...
      js_import_export: propagateJsClassicSearchParam,
      js_url_specifier: (reference, context) => {
        if (
          reference.subtype === "system_register_arg" ||
          reference.subtype === "system_import_arg"
        ) {
          return propagateJsClassicSearchParam(reference, context)
        }
        return null
      },
    },
    fetchUrlContent: async (urlInfo, context) => {
      const [jsModuleReference, jsModuleUrlInfo] =
        context.getWithoutSearchParam({
          urlInfo,
          context,
          searchParam: "as_js_classic",
          // override the expectedType to "js_module"
          // because when there is ?as_js_classic it means the underlying resource
          // is a js_module
          expectedType: "js_module",
        })
      if (!jsModuleReference) {
        return null
      }
      await context.fetchUrlContent(jsModuleUrlInfo, {
        reference: jsModuleReference,
        cleanAfterFetch: true,
      })
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        systemJsInjection,
        systemJsClientFileUrl,
        urlInfo,
        jsModuleUrlInfo,
      })
      return {
        content,
        contentType: "text/javascript",
        type: "js_classic",
        originalUrl: jsModuleUrlInfo.originalUrl,
        originalContent: jsModuleUrlInfo.originalContent,
        sourcemap,
      }
    },
  }
}
