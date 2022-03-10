import { pathToFileUrl, fileURLToPath } from "node:url"
import { isFileSystemPath } from "@jsenv/filesystem"

import { createRessourceGraph } from "@jsenv/core/src/omega/ressource_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"

export const rollupPluginJsenv = ({
  signal,
  logger,
  projectDirectoryUrl,
  plugins,
  runtimeSupport,
  sourcemapInjection,
  scenario,
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented")
  }
  let _rollupSetAssetSource = () => {
    throw new Error("not implemented")
  }
  let _rollupGetModuleInfo = () => {
    throw new Error("not implemented")
  }
  const emitAsset = ({ fileName, source }) => {
    return _rollupEmitFile({
      type: "asset",
      source,
      fileName,
    })
  }
  // rollup expects an input option, if we provide only an html file
  // without any script type module in it, we won't emit "chunk" and rollup will throw.
  // It is valid to build an html not referencing any js (rare but valid)
  // In that case jsenv emits an empty chunk and discards rollup warning about it
  // This chunk is later ignored in "generateBundle" hook
  let atleastOneChunkEmitted = false
  const emitChunk = (chunk) => {
    atleastOneChunkEmitted = true
    return _rollupEmitFile({
      type: "chunk",
      ...chunk,
    })
  }
  const setAssetSource = (rollupReferenceId, assetSource) => {
    return _rollupSetAssetSource(rollupReferenceId, assetSource)
  }
  const rollupGetModuleInfo = (id) => _rollupGetModuleInfo(id)

  const ressourceGraph = createRessourceGraph({ projectDirectoryUrl })
  const kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    scenario,
    plugins,
    runtimeSupport,
    sourcemapInjection,
    ressourceGraph,
  })
  // serverImportMetaUrlReferenceCallbackList.add(({ url }) => {
  //   // const reference = ressourceBuilder.createReferenceFoundInJsModule({
  //   //   referenceLabel: "URL + import.meta.url",
  //   //   jsUrl: serverUrl,
  //   //   jsLine: line,
  //   //   jsColumn: column,
  //   //   ressourceSpecifier: ressourceServerUrl,
  //   // })
  //   const rollupReferenceId = emitAsset()
  //   return `import.meta.ROLLUP_FILE_URL_${rollupReferenceId}`
  // })

  const ressourcesReferencedByJs = []
  const urlImporters = {}
  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args)
      _rollupSetAssetSource = (...args) => this.setAssetSource(...args)
      _rollupGetModuleInfo = (id) => this.getModuleInfo(id)
    },
    async generateBundle() {
      // late asset emission
      _rollupEmitFile = (...args) => this.emitFile(...args)
      _rollupSetAssetSource = (...args) => this.setAssetSource(...args)
    },
    resolveId: (specifier, importer = projectDirectoryUrl) => {
      if (isFileSystemPath(importer)) {
        importer = pathToFileUrl(importer).href
      }
      const url = new URL(specifier, importer).href
      const existingImporter = urlImporters[url]
      if (!existingImporter) {
        urlImporters[url] = importer
      }
      if (!url.startsWith("file:")) {
        return { url, external: true }
      }
      return fileURLToPath(url)
    },
    async load(rollupId) {
      const fileUrl = pathToFileUrl(rollupId).href
      const parentUrl = urlImporters[fileUrl] || projectDirectoryUrl
      const urlSite = ressourceGraph.getUrlSite(parentUrl, fileUrl)
      const { error, content, sourcemap } = await kitchen.cookUrl({
        outDirectoryName: `${scenario}`,
        runtimeSupport,
        parentUrl,
        urlSite,
        url: fileUrl,
      })
      if (error) {
        throw error
      }
      return {
        code: content,
        map: sourcemap,
      }
    },
    resolveFileUrl: ({
      // referenceId,
      fileName,
    }) => {
      ressourcesReferencedByJs.push(fileName)
      return `window.__resolveRessourceUrl__("./${fileName}", import.meta.url)`
    },
  }
}
