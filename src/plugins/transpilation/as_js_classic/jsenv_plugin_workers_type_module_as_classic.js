import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { analyzeNewWorkerOrNewSharedWorker } from "@jsenv/utils/js_ast/js_static_analysis.js"

// TODO: handle also service worker and shared worker in this plugin
export const jsenvPluginWorkersTypeModuleAsClassic = ({
  generateJsClassicFilename,
}) => {
  const transformJsWorkerTypes = async (urlInfo, context) => {
    const workersToTranspile = getWorkersToTranspile(urlInfo, context)
    if (
      !workersToTranspile.worker &&
      !workersToTranspile.serviceWorker &&
      !workersToTranspile.sharedServiceWorker
    ) {
      return null
    }
    const { metadata } = await applyBabelPlugins({
      babelPlugins: [
        [
          babelPluginMetadataWorkersMentions,
          {
            workersToTranspile,
          },
        ],
      ],
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
      const [newReference] = context.referenceUtils.update(reference, {
        expectedType: "js_classic",
        specifier: injectQueryParamsIntoSpecifier(specifier, {
          as_js_classic: "",
        }),
        filename: generateJsClassicFilename(reference.url),
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
    transformUrlContent: {
      js_module: transformJsWorkerTypes,
      js_classic: transformJsWorkerTypes,
    },
  }
}

const getWorkersToTranspile = (urlInfo, context) => {
  let worker = false
  let serviceWorker = false
  let sharedWorker = false
  for (const reference of urlInfo.references) {
    if (reference.expectedType === "js_module") {
      if (reference.expectedSubtype === "worker") {
        if (!context.isSupportedOnCurrentClients("worker_type_module")) {
          worker = true
        }
      }
      if (reference.expectedSubtype === "service_worker") {
        if (
          !context.isSupportedOnCurrentClients("service_worker_type_module")
        ) {
          serviceWorker = true
        }
      }
      if (reference.expectedSubtype === "shared_worker") {
        if (!context.isSupportedOnCurrentClients("shared_worker_type_module")) {
          sharedWorker = true
        }
      }
    }
  }
  return { worker, serviceWorker, sharedWorker }
}

const babelPluginMetadataWorkersMentions = (_, { workersToTranspile }) => {
  return {
    name: "metadata-new-worker-mentions",
    visitor: {
      Program(programPath, state) {
        const newWorkerMentions = []
        programPath.traverse({
          NewExpression: (path) => {
            if (workersToTranspile.worker || workersToTranspile.sharedWorker) {
              const mentions = analyzeNewWorkerOrNewSharedWorker(path)
              if (mentions) {
                newWorkerMentions.push(...mentions)
              }
            }
          },
        })
        state.file.metadata.newWorkerMentions = newWorkerMentions
      },
    },
  }
}
