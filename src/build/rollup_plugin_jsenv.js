import { pathToFileUrl, fileURLToPath } from "node:url"
import { isFileSystemPath } from "@jsenv/filesystem"

import { createRessourceGraph } from "@jsenv/core/src/omega/ressource_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"

import { createFileBuilder } from "./file_builder.js"

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

  const fileBuilder = createFileBuilder()
  const urlsReferencedByJs = []
  const urlImporters = {}
  const assetCookedPromises = []
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
      await Promise.all(assetCookedPromises)
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
      const { error, content, sourcemap, urlMentions } = await kitchen.cookUrl({
        outDirectoryName: `${scenario}`,
        runtimeSupport,
        parentUrl,
        urlSite,
        url: fileUrl,
      })
      if (error) {
        throw error
      }
      urlMentions.map(async (urlMention) => {
        if (urlMention.type === "js_import_meta_url_pattern") {
          const urlSite = {
            url: fileUrl,
            line: urlMention.line,
            column: urlMention.column,
          }
          const referenceUrl = urlMention.url
          // const reference = fileBuilder.createReferenceFoundInJsModule({
          //   label: "URL + import.meta.url",
          //   urlSite,
          //   url: referenceUrl,
          // })
          // TODO: cook + emit asset once per url
          const assetContext = await kitchen.cookUrl({
            outDirectoryName: `${scenario}`,
            runtimeSupport,
            parentUrl: fileUrl,
            urlSite,
            url: referenceUrl,
          })
          if (assetContext.error) {
            throw assetContext.error
          }
          const rollupReferenceId = emitAsset({
            fileName: "", // quel sera le fileName?
            source: assetContext.content,
          })
          return `import.meta.ROLLUP_FILE_URL_${rollupReferenceId}`
        }
      })
      return {
        code: content,
        map: sourcemap,
      }
    },
    resolveFileUrl: ({
      // referenceId,
      fileName,
    }) => {
      urlsReferencedByJs.push(fileName)
      // TODO: inject window.__resolveFileUrl__ into every html page
      // (likely a plugin to pass to kitchen)
      // and use it for import.meta.url pattern and dynamic import.
      // for static import not possible we'll have to use the versioned url
      return `window.__resolveRessourceUrl__("./${fileName}", import.meta.url)`
    },
  }
}
