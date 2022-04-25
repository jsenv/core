import { createRequire } from "node:module"
import { readFileSync } from "@jsenv/filesystem"

import { requireBabelPlugin } from "@jsenv/babel-plugins"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { injectQueryParams } from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"
import { babelPluginTransformImportMetaUrl } from "./helpers/babel_plugin_transform_import_meta_url.js"
import { jsenvPluginScriptTypeModuleAsClassic } from "./jsenv_plugin_script_type_module_as_classic.js"
import { jsenvPluginWorkersTypeModuleAsClassic } from "./jsenv_plugin_workers_type_module_as_classic.js"
import { jsenvPluginTopLevelAwait } from "./jsenv_plugin_top_level_await.js"

const require = createRequire(import.meta.url)

export const jsenvPluginAsJsClassic = ({ systemJsInjection }) => {
  const systemJsClientFileUrl = new URL("./client/s.js", import.meta.url).href

  return [
    asJsClassic({ systemJsInjection, systemJsClientFileUrl }),
    jsenvPluginScriptTypeModuleAsClassic({
      systemJsInjection,
      systemJsClientFileUrl,
    }),
    jsenvPluginWorkersTypeModuleAsClassic(),
    jsenvPluginTopLevelAwait(),
  ]
}

const asJsClassic = ({ systemJsInjection, systemJsClientFileUrl }) => {
  return {
    name: "jsenv:as_js_classic",
    appliesDuring: "*",
    // forward ?as_js_classic to referenced urls
    normalize: (reference, context) => {
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
      return urlTransformed
    },
    load: async (urlInfo, context) => {
      const urlObject = new URL(urlInfo.url)
      const { searchParams } = urlObject
      if (!searchParams.has("as_js_classic")) {
        return null
      }
      searchParams.delete("as_js_classic")
      const originalUrl = urlObject.href
      const originalReference = {
        ...context.reference,
      }
      originalReference.url = originalUrl
      const originalUrlInfo = context.urlGraph.reuseOrCreateUrlInfo(
        originalReference.url,
      )
      await context.load({
        reference: originalReference,
        urlInfo: originalUrlInfo,
      })
      const jsClassicFormat =
        originalUrlInfo.data.usesImport || originalUrlInfo.data.usesExport
          ? "system"
          : "umd"
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        systemJsInjection,
        systemJsClientFileUrl,
        urlInfo: originalUrlInfo,
        jsClassicFormat,
      })
      urlInfo.data.jsClassicFormat = jsClassicFormat
      return {
        type: "js_classic",
        contentType: "text/javascript",
        content,
        sourcemap,
      }
    },
  }
}

const convertJsModuleToJsClassic = async ({
  systemJsInjection,
  systemJsClientFileUrl,
  urlInfo,
  jsClassicFormat,
}) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [
      ...(jsClassicFormat === "system"
        ? [
            // propposal-dynamic-import required with systemjs for babel8:
            // https://github.com/babel/babel/issues/10746
            require("@babel/plugin-proposal-dynamic-import"),
            [
              requireBabelPlugin("babel-plugin-transform-async-to-promises"),
              {
                topLevelAwait: "return",
              },
            ],
            require("@babel/plugin-transform-modules-systemjs"),
          ]
        : [
            [
              requireBabelPlugin("babel-plugin-transform-async-to-promises"),
              {
                topLevelAwait: "simple",
              },
            ],
            babelPluginTransformImportMetaUrl,
            require("@babel/plugin-transform-modules-umd"),
          ]),
    ],
    urlInfo,
  })
  if (
    systemJsInjection &&
    jsClassicFormat === "system" &&
    (urlInfo.data.isEntryPoint ||
      urlInfo.subtype === "worker" ||
      urlInfo.subtype === "service_worker" ||
      urlInfo.subtype === "shared_worker")
  ) {
    const magicSource = createMagicSource(code)
    const systemjsCode = readFileSync(systemJsClientFileUrl, { as: "string" })
    magicSource.prepend(`${systemjsCode}\n\n`)
    const { content, sourcemap } = magicSource.toContentAndSourcemap()
    return {
      content,
      sourcemap: await composeTwoSourcemaps(map, sourcemap),
    }
  }
  return {
    content: code,
    sourcemap: map,
  }
}
