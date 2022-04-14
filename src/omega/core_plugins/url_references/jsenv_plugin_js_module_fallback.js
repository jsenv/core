import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic"

import { analyzeNewWorkerCall } from "./js_static_analysis.js"

export const jsenvPluginJsModuleFallback = () => {
  return [
    {
      name: "jsenv:js_module_fallback",
      appliesDuring: "*",
      transform: {
        js_module: async (urlInfo, context) => {
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
            const [newReference, newUrlInfo] =
              context.referenceUtils.updateSpecifier(
                JSON.stringify(specifier),
                newSpecifier,
              )
            newUrlInfo.data.toto = true
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
    },
    jsenvPluginAsJsClassic(),
  ]
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
