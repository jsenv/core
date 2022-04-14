import { urlToBasename } from "@jsenv/filesystem"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import {
  injectQueryParams,
  injectQueryParamsIntoSpecifier,
} from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { analyzeNewWorkerCall } from "@jsenv/utils/js_ast/js_static_analysis.js"

import { esToIIFE } from "./helpers/es_to_iife.js"
import { esToSystem } from "./helpers/es_to_system.js"

export const jsenvPluginJsModuleAsJsClassic = () => {
  const convertJsModuleToJsClassic = async (urlInfo) => {
    const usesImportExport = urlInfo.references.some(
      (ref) => ref.type === "js_import_export",
    )
    if (usesImportExport) {
      const { sourcemap, content } = await esToSystem({
        url: urlInfo.data.sourceUrl || urlInfo.url,
        generatedUrl: urlInfo.generatedUrl,
        content: urlInfo.content,
      })
      urlInfo.type = "js_classic"
      return {
        sourcemap,
        content,
      }
    }
    const { sourcemap, content } = esToIIFE({
      name: urlToBasename(urlInfo.url),
      url: urlInfo.url,
      content: urlInfo.content,
    })
    urlInfo.type = "js_classic"
    return {
      sourcemap,
      content,
    }
  }

  return {
    name: "jsenv:js_module_as_js_classic",
    appliesDuring: "*",
    // forward ?as_js_classic to referenced urls
    transformReferencedUrl: (reference) => {
      const parentUrl = reference.parentUrl
      if (!new URL(parentUrl).searchParams.has("as_js_classic")) {
        return null
      }
      return injectQueryParams(reference.url, {
        as_js_classic: "",
      })
    },
    transform: {
      js_module: async (urlInfo, context) => {
        if (urlInfo.url.includes("ping.js")) {
          debugger
        }
        if (new URL(urlInfo.url).searchParams.has("as_js_classic")) {
          return convertJsModuleToJsClassic(urlInfo)
        }
        const usesWorkerTypeModule = urlInfo.references.some(
          (ref) =>
            ref.expectedSubtype === "worker" &&
            ref.expectedType === "js_module",
        )
        if (
          !usesWorkerTypeModule ||
          context.isSupportedOnCurrentClient("worker_type_module")
        ) {
          return null
        }

        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataNewWorkerCalls],
          url: urlInfo.url,
          generatedUrl: urlInfo.generatedUrl,
          content: urlInfo.content,
        })
        const { newWorkerCalls } = metadata
        const magicSource = createMagicSource(urlInfo.content)
        newWorkerCalls.forEach((newWorkerCall) => {
          if (newWorkerCall.expectedType !== "js_module") {
            return
          }
          const specifier = newWorkerCall.specifierNode.value
          const newSpecifier = injectQueryParamsIntoSpecifier(specifier, {
            as_js_classic: "",
          })
          const [newReference] = context.referenceUtils.updateSpecifier(
            JSON.stringify(specifier),
            newSpecifier,
          )
          magicSource.replace({
            start: newWorkerCall.specifierNode.start,
            end: newWorkerCall.specifierNode.end,
            replacement: newReference.generatedSpecifier,
          })
          magicSource.replace({
            start: newWorkerCall.typeArgNode.value.start,
            end: newWorkerCall.typeArgNode.value.end,
            replacement: JSON.stringify("classic"),
          })
        })
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}

const babelPluginMetadataNewWorkerCalls = () => {
  return {
    name: "metadata-new-worker-calls",
    visitor: {
      Program(programPath, state) {
        const newWorkerCalls = []
        programPath.traverse({
          NewExpression: (path) => {
            const newWorkerReferenceInfos = analyzeNewWorkerCall(path)
            if (newWorkerReferenceInfos) {
              const [newWorkerCall] = newWorkerReferenceInfos
              newWorkerCalls.push(newWorkerCall)
              return
            }
          },
        })
        state.file.metadata.newWorkerCalls = newWorkerCalls
      },
    },
  }
}
