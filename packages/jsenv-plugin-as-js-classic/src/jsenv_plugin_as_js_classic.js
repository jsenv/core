import { createRequire } from "node:module"
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { urlToBasename } from "@jsenv/filesystem"

import { esToIIFE } from "./es_to_iife.js"

const require = createRequire(import.meta.url)

export const jsenvPluginAsJsClassic = () => {
  return {
    name: "jsenv:as_js_classic",
    appliesDuring: "*",
    finalize: {
      html: async () => {
        // something to do? (like injecting systemjs when script_type_module are not supported)
        // and html uses some script type module?
        return null
      },
      js_module: async (urlInfo) => {
        if (!new URL(urlInfo.url).searchParams.has("as_js_classic")) {
          return null
        }
        const usesImportExport = urlInfo.references.some(
          (ref) => ref.type === "js_import_export",
        )
        if (usesImportExport) {
          const { code, map } = await applyBabelPlugins({
            babelPlugins: [require("@babel/plugin-transform-modules-systemjs")],
            url: urlInfo.data.sourceUrl || urlInfo.url,
            generatedUrl: urlInfo.generatedUrl,
            content: urlInfo.content,
          })
          return {
            content: code,
            sourcemap: map,
          }
        }
        return esToIIFE({
          name: urlToBasename(urlInfo.url),
          url: urlInfo.url,
          content: urlInfo.content,
        })
      },
    },
  }
}
