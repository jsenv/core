import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import {
  analyzeNewWorkerOrNewSharedWorker,
  analyzeServiceWorkerRegisterCall,
} from "@jsenv/utils/js_ast/js_static_analysis.js"

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
          babelPluginMetadataWorkerMentions,
          {
            workersToTranspile,
          },
        ],
      ],
      urlInfo,
    })
    const { workerMentions } = metadata
    const magicSource = createMagicSource(urlInfo.content)
    workerMentions.forEach((workerMention) => {
      if (workerMention.expectedType !== "js_module") {
        return
      }
      const specifier = workerMention.specifier
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
        start: workerMention.start,
        end: workerMention.end,
        replacement: newReference.generatedSpecifier,
      })
      magicSource.replace({
        start: workerMention.typeArgNode.value.start,
        end: workerMention.typeArgNode.value.end,
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
    if (reference.expectedType !== "js_module") {
      continue
    }
    if (
      reference.expectedSubtype === "worker" &&
      !context.isSupportedOnCurrentClients("worker_type_module")
    ) {
      worker = true
    }
    if (
      reference.expectedSubtype === "service_worker" &&
      !context.isSupportedOnCurrentClients("service_worker_type_module")
    ) {
      serviceWorker = true
    }
    if (
      reference.expectedSubtype === "shared_worker" &&
      !context.isSupportedOnCurrentClients("shared_worker_type_module")
    ) {
      sharedWorker = true
    }
  }
  return { worker, serviceWorker, sharedWorker }
}

const babelPluginMetadataWorkerMentions = (_, { workersToTranspile }) => {
  return {
    name: "metadata-worker-mentions",
    visitor: {
      Program(programPath, state) {
        const workerMentions = []
        const visitors = {
          NewExpression: (path) => {
            if (workersToTranspile.worker || workersToTranspile.sharedWorker) {
              const mentions = analyzeNewWorkerOrNewSharedWorker(path)
              if (mentions) {
                workerMentions.push(...mentions)
              }
            }
          },
        }
        if (workersToTranspile.serviceWorker) {
          visitors.CallExpression = (path) => {
            const mentions = analyzeServiceWorkerRegisterCall(path)
            if (mentions) {
              workerMentions.push(...mentions)
            }
          }
        }
        programPath.traverse(visitors)
        state.file.metadata.workerMentions = workerMentions
      },
    },
  }
}
