import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/url-meta"

import { fetchOriginalUrlInfo } from "@jsenv/utils/graph/fetch_original_url_info.js"
import { injectQueryParams } from "@jsenv/utils/urls/url_utils.js"
import { commonJsToJsModule } from "./cjs_to_esm.js"

export const jsenvPluginCommonJs = ({
  name = "jsenv:commonjs",
  logLevel,
  include,
}) => {
  const structuredMetaMap = normalizeStructuredMetaMap(
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
        const { commonjs } = urlToMeta({
          url: reference.url,
          structuredMetaMap,
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
      const originalUrlInfo = await fetchOriginalUrlInfo({
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
        type: "js_module",
        contentType: "text/javascript",
        content,
        sourcemap,
      }
    },
  }
}
