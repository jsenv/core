import { createRequire } from "node:module"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import {
  injectQueryParams,
  injectQueryParamsIntoSpecifier,
} from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { analyzeNewWorkerCall } from "@jsenv/utils/js_ast/js_static_analysis.js"

const require = createRequire(import.meta.url)

export const jsenvPluginJsModuleAsJsClassic = () => {
  const convertJsModuleToJsClassic = async (urlInfo) => {
    const outFormat =
      urlInfo.data.usesImport || urlInfo.data.usesExport ? "systemjs" : "umd"
    const { code, map } = await applyBabelPlugins({
      babelPlugins: [
        outFormat === "systemjs"
          ? require("@babel/plugin-transform-modules-systemjs")
          : require("@babel/plugin-transform-modules-umd"),
      ],
      url: urlInfo.data.rawUrl || urlInfo.url,
      generatedUrl: urlInfo.generatedUrl,
      content: urlInfo.content,
    })
    urlInfo.type = "js_classic"
    return {
      content: code,
      sourcemap: map,
    }
  }

  return {
    name: "jsenv:js_module_as_js_classic",
    appliesDuring: "*",
    // forward ?as_js_classic to referenced urls
    normalize: (reference, context) => {
      const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
      if (!parentUrlInfo || !parentUrlInfo.data.asJsClassic) {
        return null
      }
      const urlTransformed = injectQueryParams(reference.url, {
        as_js_classic: "",
      })
      return urlTransformed
    },
    transform: {
      js_module: async (urlInfo, context) => {
        if (
          // during build the info must be read from "data.asJsClassic"
          // because the specifier becomes "worker.es5.js" without query param
          urlInfo.data.asJsClassic ||
          new URL(urlInfo.url).searchParams.has("as_js_classic")
        ) {
          urlInfo.data.asJsClassic = true
          return convertJsModuleToJsClassic(urlInfo)
        }
        const usesWorkerTypeModule = urlInfo.references.some(
          (ref) =>
            ref.expectedSubtype === "worker" &&
            ref.expectedType === "js_module",
        )
        if (
          !usesWorkerTypeModule ||
          context.isSupportedOnCurrentClients("worker_type_module")
        ) {
          return null
        }

        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataNewWorkerMentions],
          url: urlInfo.url,
          generatedUrl: urlInfo.generatedUrl,
          content: urlInfo.content,
        })
        const { newWorkerMentions } = metadata
        const magicSource = createMagicSource(urlInfo.content)
        newWorkerMentions.forEach((newWorkerMention) => {
          if (newWorkerMention.expectedType !== "js_module") {
            return
          }
          const specifier = newWorkerMention.specifier
          // during dev/test, browser will do the fetch
          // during build it's a bit different
          const newSpecifier = injectQueryParamsIntoSpecifier(specifier, {
            as_js_classic: "",
          })
          const [newReference, newUrlInfo] =
            context.referenceUtils.updateSpecifier(
              JSON.stringify(specifier),
              newSpecifier,
            )
          newUrlInfo.data.asJsClassic = true
          magicSource.replace({
            start: newWorkerMention.start,
            end: newWorkerMention.end,
            replacement: newReference.generatedSpecifier,
          })
          magicSource.replace({
            start: newWorkerMention.typeArgNode.value.start,
            end: newWorkerMention.typeArgNode.value.end,
            replacement: JSON.stringify("classic"),
          })
        })
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}

const babelPluginMetadataNewWorkerMentions = () => {
  return {
    name: "metadata-new-worker-mentions",
    visitor: {
      Program(programPath, state) {
        const newWorkerMentions = []
        programPath.traverse({
          NewExpression: (path) => {
            const mentions = analyzeNewWorkerCall(path)
            if (mentions) {
              newWorkerMentions.push(...mentions)
            }
          },
        })
        state.file.metadata.newWorkerMentions = newWorkerMentions
      },
    },
  }
}
