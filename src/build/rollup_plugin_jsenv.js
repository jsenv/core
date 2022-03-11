import { pathToFileUrl, fileURLToPath } from "node:url"
import { isFileSystemPath, urlToFilename } from "@jsenv/filesystem"

import { createRessourceGraph } from "@jsenv/core/src/omega/ressource_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"

import { jsenvPluginAvoidVersioningCascade } from "./plugins/avoid_versioning_cascade/jsenv_plugin_avoid_versioning_cascade.js"

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
    plugins: [jsenvPluginAvoidVersioningCascade(), ...plugins],
    runtimeSupport,
    sourcemapInjection,
    ressourceGraph,
  })

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
      await Promise.all(
        urlMentions.map(async (urlMention) => {
          if (urlMention.type === "js_import_meta_url_pattern") {
            const urlSite = {
              url: fileUrl,
              line: urlMention.line,
              column: urlMention.column,
            }
            const referenceUrl = urlMention.url
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
              fileName: urlToFilename(referenceUrl),
              source: assetContext.content,
            })
            return `import.meta.ROLLUP_FILE_URL_${rollupReferenceId}`
          }
        }),
      )
      return {
        code: content,
        map: sourcemap,
      }
    },
    resolveFileUrl: ({ moduleId, fileName }) => {
      urlsReferencedByJs.push(pathToFileUrl(moduleId).href)
      return `window.__resolveUrl__("./${fileName}", import.meta.url)`
    },
    renderDynamicImport: ({ moduleId }) => {
      urlsReferencedByJs.push(pathToFileUrl(moduleId).href)
      return {
        left: "window.__resolveUrl__(",
        right: ", import.meta.url)",
      }
    },
  }
}
