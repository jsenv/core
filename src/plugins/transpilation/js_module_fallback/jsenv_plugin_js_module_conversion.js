/*
 * - propagate "?as_js_module_fallback" query string param on urls
 * - perform conversion from js module to js classic when url uses "?as_js_module_fallback"
 */

import { injectQueryParams } from "@jsenv/urls"
import { convertJsModuleToJsClassic } from "./convert_js_module_to_js_classic.js"

export const jsenvPluginJsModuleConversion = ({
  systemJsInjection,
  systemJsClientFileUrl,
  generateJsClassicFilename,
}) => {
  const isReferencingJsModule = (reference) => {
    if (
      reference.type === "js_import" ||
      reference.subtype === "system_register_arg" ||
      reference.subtype === "system_import_arg"
    ) {
      return true
    }
    if (reference.type === "js_url" && reference.expectedType === "js_module") {
      return true
    }
    return false
  }

  const shouldPropagateJsModuleConversion = (reference, context) => {
    if (isReferencingJsModule(reference, context)) {
      const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
      if (!parentUrlInfo) {
        return false
      }
      const parentGotAsJsClassic = new URL(parentUrlInfo.url).searchParams.has(
        "as_js_module_fallback",
      )
      return parentGotAsJsClassic
    }
    return false
  }

  const markAsJsClassicProxy = (reference) => {
    reference.expectedType = "js_classic"
    reference.filename = generateJsClassicFilename(reference.url)
  }

  const turnIntoJsClassicProxy = (reference) => {
    const urlTransformed = injectQueryParams(reference.url, {
      as_js_module_fallback: "",
    })
    markAsJsClassicProxy(reference)
    return urlTransformed
  }

  return {
    name: "jsenv:js_module_conversion",
    appliesDuring: "*",
    redirectUrl: (reference, context) => {
      if (reference.searchParams.has("as_js_module_fallback")) {
        markAsJsClassicProxy(reference)
        return null
      }
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline resources
      // or specifiers inside new URL()...
      if (shouldPropagateJsModuleConversion(reference, context)) {
        return turnIntoJsClassicProxy(reference, context)
      }
      return null
    },
    fetchUrlContent: async (urlInfo, context) => {
      const [jsModuleReference, jsModuleUrlInfo] =
        context.getWithoutSearchParam({
          urlInfo,
          context,
          searchParam: "as_js_module_fallback",
          // override the expectedType to "js_module"
          // because when there is ?as_js_module_fallback it means the underlying resource
          // is a js_module
          expectedType: "js_module",
        })
      if (!jsModuleReference) {
        return null
      }
      await context.fetchUrlContent(jsModuleUrlInfo, {
        reference: jsModuleReference,
      })
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: jsModuleReference.subtype,
          specifier: jsModuleReference.url,
          expectedType: "js_module",
        })
      } else if (context.build && jsModuleUrlInfo.dependents.size === 0) {
        context.urlGraph.deleteUrlInfo(jsModuleUrlInfo.url)
      }
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        rootDirectoryUrl: context.rootDirectoryUrl,
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
        data: jsModuleUrlInfo.data,
      }
    },
  }
}
