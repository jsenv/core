import { createRequire } from "node:module"
import { readFileSync, urlToFilename } from "@jsenv/filesystem"

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
      generateJsClassicFilename,
    }),
    jsenvPluginWorkersTypeModuleAsClassic({
      generateJsClassicFilename,
    }),
    jsenvPluginTopLevelAwait(),
  ]
}

const asJsClassic = ({ systemJsInjection, systemJsClientFileUrl }) => {
  return {
    name: "jsenv:as_js_classic",
    appliesDuring: "*",
    // forward ?as_js_classic to referenced urls
    normalizeUrl: (reference, context) => {
      if (reference.isInline) {
        if (reference.contentType !== "text/javascript") {
          // We want to propagate transformation of js module to js classic
          // so we don't want to propagate when the reference is not js:
          // - ignore "string" in `JSON.parse(string)` for instance
          return null
        }
      }
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
    },
    fetchUrlContent: async (urlInfo, context) => {
      const urlObject = new URL(urlInfo.url)
      const { searchParams } = urlObject
      if (!searchParams.has("as_js_classic")) {
        return null
      }
      searchParams.delete("as_js_classic")
      const originalUrl = urlObject.href
      const originalReference = {
        ...(context.reference.original || context.reference),
        // override the expectedType to "js_module"
        // because when there is ?as_js_classic it means the underlying ressource
        // is a js_module
        expectedType: "js_module",
      }
      originalReference.url = originalUrl
      const originalUrlInfo = context.urlGraph.reuseOrCreateUrlInfo(
        originalReference.url,
      )
      await context.fetchUrlContent({
        reference: originalReference,
        urlInfo: originalUrlInfo,
      })
      const isJsEntryPoint =
        // in general html files are entry points
        // but during build js can be sepcified as an entry point
        // (meaning there is no html file where we can inject systemjs)
        // in that case we need to inject systemjs in the js file
        originalUrlInfo.data.isEntryPoint ||
        // the following apis are creating js entry points:
        // - new Worker()
        // - new SharedWorker()
        // - navigator.serviceWorker.register()
        // In thoose case we need to inject systemjs the worker js file
        isWebWorkerEntryPointReference(originalReference)
      // if it's an entry point without dependency (it does not use import)
      // then we can use UMD, otherwise we have to use systemjs
      // because it is imported by systemjs
      const jsClassicFormat =
        isJsEntryPoint && !originalUrlInfo.data.usesImport ? "umd" : "system"
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        systemJsInjection,
        systemJsClientFileUrl,
        urlInfo: originalUrlInfo,
        isJsEntryPoint,
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

const generateJsClassicFilename = (url) => {
  const filename = urlToFilename(url)
  const [basename, extension] = splitFileExtension(filename)
  return `${basename}.es5${extension}`
}

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".")
  if (dotLastIndex === -1) {
    return [filename, ""]
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)]
}

const isWebWorkerEntryPointReference = (reference) => {
  if (reference.subtype === "new_url_first_arg") {
    return ["worker", "service_worker", "shared_worker"].includes(
      reference.expectedSubtype,
    )
  }
  return [
    "new_worker_first_arg",
    "new_shared_worker_first_arg",
    "service_worker_register_first_arg",
  ].includes(reference.subtype)
}

const convertJsModuleToJsClassic = async ({
  systemJsInjection,
  systemJsClientFileUrl,
  urlInfo,
  isJsEntryPoint,
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
  if (systemJsInjection && jsClassicFormat === "system" && isJsEntryPoint) {
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
