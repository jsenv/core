import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { analyzeNewWorkerCall } from "@jsenv/utils/js_ast/js_static_analysis.js"

// TODO: handle also service worker and shared worker in this plugin
export const jsenvPluginWorkersTypeModuleAsClassic = () => {
  const transformJsWorkerTypes = async (urlInfo, context) => {
    const usesWorkerTypeModule = urlInfo.references.some(
      (ref) =>
        ref.expectedType === "js_module" && ref.expectedSubtype === "worker",
    )
    if (!usesWorkerTypeModule) {
      return null
    }
    if (context.isSupportedOnCurrentClients("worker_type_module")) {
      return null
    }
    const { metadata } = await applyBabelPlugins({
      babelPlugins: [babelPluginMetadataNewWorkerMentions],
      urlInfo,
    })
    const { newWorkerMentions } = metadata
    const magicSource = createMagicSource(urlInfo.content)
    newWorkerMentions.forEach((newWorkerMention) => {
      if (newWorkerMention.expectedType !== "js_module") {
        return
      }
      const specifier = newWorkerMention.specifier
      const reference = context.referenceUtils.findByGeneratedSpecifier(
        JSON.stringify(specifier),
      )
      const [newReference] = context.referenceUtils.updateReference(reference, {
        specifier: injectQueryParamsIntoSpecifier(specifier, {
          as_js_classic: "",
        }),
      })
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
  }

  return {
    name: "jsenv:workers_type_module_as_classic",
    appliesDuring: "*",
    transform: {
      js_module: transformJsWorkerTypes,
      js_classic: transformJsWorkerTypes,
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
