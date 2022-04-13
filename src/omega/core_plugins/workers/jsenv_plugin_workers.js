export const jsenvPluginWorkers = () => {
  return {
    name: "jsenv:workers",
    appliesDuring: "*",
    transform: {
      js_module: async (urlInfo, { referenceUtils }) => {},
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
