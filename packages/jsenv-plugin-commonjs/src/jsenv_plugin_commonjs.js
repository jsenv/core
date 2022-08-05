import { URL_META } from "@jsenv/url-meta"
import { injectQueryParams, urlToExtension } from "@jsenv/urls"

import { commonJsToJsModule } from "./cjs_to_esm.js"

export const jsenvPluginCommonJs = ({
  name = "jsenv:commonjs",
  logLevel,
  include,
}) => {
  let associations

  return {
    name,
    appliesDuring: "*",
    init: ({ rootDirectoryUrl }) => {
      associations = URL_META.resolveAssociations(
        {
          commonjs: include,
        },
        rootDirectoryUrl,
      )
    },
    redirectUrl: {
      js_import_export: (reference) => {
        const { commonjs } = URL_META.applyAssociations({
          url: reference.url,
          associations,
        })
        if (!commonjs) {
          return null
        }
        reference.data.commonjs = commonjs
        return injectQueryParams(reference.url, {
          cjs_as_js_module: "",
        })
      },
    },
    fetchUrlContent: async (urlInfo, context) => {
      const [commonJsReference, commonJsUrlInfo] =
        context.getWithoutSearchParam({
          urlInfo,
          context,
          searchParam: "cjs_as_js_module",
          // during this fetch we don't want to alter the original file
          // so we consider it as text
          expectedType: "text",
        })
      if (!commonJsReference) {
        return null
      }
      await context.fetchUrlContent(commonJsUrlInfo, {
        reference: commonJsReference,
        cleanAfterFetch: true,
      })
      const nodeRuntimeEnabled = Object.keys(context.runtimeCompat).includes(
        "node",
      )
      const { content, sourcemap, isValid } = await commonJsToJsModule({
        logLevel,
        rootDirectoryUrl: context.rootDirectoryUrl,
        sourceFileUrl: commonJsUrlInfo.url,
        browsers: !nodeRuntimeEnabled,
        processEnvNodeEnv: context.scenarios.dev ? "development" : "production",
        ...urlInfo.data.commonjs,
      })
      if (isValid) {
        urlInfo.isValid = isValid
      }
      const originalReference = context.reference.original
        ? context.reference.original
        : context.reference
      const filename = originalReference.dependsOnPackageJson
        ? `${originalReference.specifier}${urlToExtension(
            originalReference.parentUrl,
          )}`
        : undefined
      return {
        content,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: commonJsUrlInfo.originalUrl,
        originalContent: commonJsUrlInfo.originalContent,
        sourcemap,
        filename,
      }
    },
  }
}
