import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"

export const jsenvPluginWorkers = () => {
  return {
    name: "jsenv:workers",
    appliesDuring: "*",
    transform: {
      js_module: async (urlInfo, { referenceUtils }) => {
        // TODO: move this to url mentions at some point
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataWorkerMentions],
          url: urlInfo.url,
          generatedUrl: urlInfo.generatedUrl,
          content: urlInfo.content,
        })
        const { workerMentions } = metadata
        if (workerMentions.length === 0) {
          return
        }
        // une option pourrait etre de cook
        // la référence direct lorsque les worker ne sont pas supporté
        workerMentions.forEach((workerMention) => {
          referenceUtils.found({
            type: workerMention.type,
            specifier: workerMention.specifier,
            line: workerMention.line,
            column: workerMention.column,
          })
        })
      },
    },
    normalize: (reference, { urlGraph, runtimeSupport }) => {
      const parentUrlInfo = urlGraph.getUrlInfo(reference.parentUrl)
      if (parentUrlInfo && parentUrlInfo.subtype === "worker") {
        // si le parent est un worker
        // et qu'il est lui meme référencé en mode type: "module"
        // alors ajoute a cette url qu'on veut la convertir en iife ou systemjs
        // avec un queryparam genre ?iffe ou ?systemjs
        // et il nous faut un plugin capable de faire cette conversion
        // (dans le hook finalize je suppose)
      }
    },
  }
}

const babelPluginMetadataWorkerMentions = () => {
  return {
    name: "metadata-worker-mentions",
    visitor: {
      Program(programPath, state) {
        const workerMentions = []
        // TODO: detect new Worker(specifier, { type })
        // and navigator.serviceWorker.register(specifier, { type })
        // the "type" will be set on reference as "expectedType"
        // the "type" will be replaced in the source when not supported
        // from "module" to "classic" (which will be ignored)

        state.file.metadata.workerMentions = workerMentions
      },
    },
  }
}
