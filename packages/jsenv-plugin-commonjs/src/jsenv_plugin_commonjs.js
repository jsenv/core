import { URL_META } from "@jsenv/url-meta"
import { injectQueryParams } from "@jsenv/urls"

import { commonJsToJsModule } from "./cjs_to_esm.js"

export const jsenvPluginCommonJs = ({
  name = "jsenv:commonjs",
  logLevel,
  include,
}) => {
  const associations = URL_META.resolveAssociations(
    {
      commonjs: include,
    },
    "file://",
  )

  return {
    name,
    appliesDuring: "*",
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
      const originalUrlInfo = await context.fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "cjs_as_js_module",
        // during this fetch we don't want to alter the original file
        // so we consider it as text
        expectedType: "text",
      })
      if (!originalUrlInfo) {
        return null
      }
      const { content, sourcemap } = await commonJsToJsModule({
        logLevel,
        rootDirectoryUrl: context.rootDirectoryUrl,
        sourceFileUrl: originalUrlInfo.url,
        processEnvNodeEnv:
          context.scenario === "dev" || context.scenario === "test"
            ? "development"
            : "production",
        ...urlInfo.data.commonjs,
      })
      return {
        content,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: originalUrlInfo.originalUrl,
        originalContent: originalUrlInfo.originalContent,
        sourcemap,
      }
    },
  }
}
