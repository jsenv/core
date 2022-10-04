/*
 * - propagate ?as_js_classic to urls
 * - perform conversion from js module to js classic when url uses ?as_js_classic
 */

import { injectQueryParams } from "@jsenv/urls"
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"
import { convertJsModuleToJsClassic } from "./convert_js_module_to_js_classic.js"

export const jsenvPluginAsJsClassicConversion = ({
  systemJsInjection,
  systemJsClientFileUrl,
  generateJsClassicFilename,
}) => {
  const isReferencingJsModule = (reference) => {
    if (
      reference.type === "js_import_export" ||
      reference.subtype === "system_register_arg" ||
      reference.subtype === "system_import_arg"
    ) {
      return true
    }
    if (reference.type === "js_url_specifier") {
      if (reference.expectedType === "js_classic") {
        return false
      }
      if (
        reference.expectedType === undefined &&
        CONTENT_TYPE.fromUrlExtension(reference.url) === "text/javascript"
      ) {
        // by default, js referenced by new URL is considered as "js_module"
        // in case this is not desired code must use "?js_classic" like
        // new URL('./file.js?js_classic', import.meta.url)
        return true
      }
    }
    return false
  }

  const shouldPropagateJsClassic = (reference, context) => {
    if (isReferencingJsModule(reference, context)) {
      const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
      if (!parentUrlInfo) {
        return false
      }
      if (parentUrlInfo.isEntryPoint) {
        return true
      }
      return new URL(parentUrlInfo.url).searchParams.has("as_js_classic")
    }

    return false
  }
  const markAsJsClassicProxy = (reference) => {
    reference.expectedType = "js_classic"
    reference.filename = generateJsClassicFilename(reference.url)
  }
  const turnIntoJsClassicProxy = (reference) => {
    const urlTransformed = injectQueryParams(reference.url, {
      as_js_classic: "",
    })
    markAsJsClassicProxy(reference)
    return urlTransformed
  }

  return {
    name: "jsenv:as_js_classic_conversion",
    appliesDuring: "*",
    redirectUrl: (reference, context) => {
      if (reference.searchParams.has("as_js_classic")) {
        markAsJsClassicProxy(reference)
        return null
      }
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline resources
      // or specifiers inside new URL()...
      if (shouldPropagateJsClassic(reference, context)) {
        return turnIntoJsClassicProxy(reference, context)
      }
      return null
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
      })
      if (context.scenarios.dev) {
        context.referenceUtils.found({
          type: "js_import_export",
          subtype: jsModuleReference.subtype,
          specifier: jsModuleReference.url,
          expectedType: "js_module",
        })
      } else if (
        context.scenarios.build &&
        jsModuleUrlInfo.dependents.size === 0
      ) {
        context.urlGraph.deleteUrlInfo(jsModuleUrlInfo.url)
      }
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
