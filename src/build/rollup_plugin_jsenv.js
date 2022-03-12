import { fileURLToPath, pathToFileURL } from "node:url"
import { isFileSystemPath } from "@jsenv/filesystem"

const EMPTY_CHUNK_URL = "virtual:__empty__"

export const rollupPluginJsenv = ({
  signal,
  logger,
  projectDirectoryUrl,
  buildDirectoryUrl,
  projectGraph,
  runtimeSupport,
  sourcemapInjection,
  scenario,
  resultRef,
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented")
  }
  let _rollupGetModuleInfo = () => {
    throw new Error("not implemented")
  }
  const emitChunk = (chunk) => {
    return _rollupEmitFile({
      type: "chunk",
      ...chunk,
    })
  }
  const rollupGetModuleInfo = (id) => _rollupGetModuleInfo(id)

  const urlsReferencedByJs = []
  const urlImporters = {}

  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args)
      _rollupGetModuleInfo = (id) => this.getModuleInfo(id)
      // emit all entry points from projectGraph
      if (!atLeastOneChunkEmitted) {
        emitChunk({
          id: EMPTY_CHUNK_URL,
          fileName: "__empty__",
        })
      }
    },
    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args)
      delete rollupResult["__empty__"]

      const buildFileContents = {}
      Object.keys(rollupResult).forEach((fileName) => {
        const rollupFileInfo = rollupResult[fileName]
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const { facadeModuleId } = rollupFileInfo
          if (facadeModuleId) {
            rollupFileInfo.url = pathToFileURL(facadeModuleId).href
          } else {
            const { sources } = rollupFileInfo.map
            const sourcePath = sources[sources.length - 1]
            rollupFileInfo.url = pathToFileURL(sourcePath).href
          }
        }
      })
      // on veut aussi itérer sur tous les assets pour les mettre dans "buildFileContents"
      resultRef.current = {
        buildFileContents,
      }
    },
    outputOptions: (outputOptions) => {
      Object.assign(outputOptions, {
        format: "esm",
        dir: fileURLToPath(buildDirectoryUrl),
        entryFileNames: () => {
          return `[name].js`
        },
        // assetFileNames: () => {
        //   return `assets/[name][extname]`
        // },
        chunkFileNames: () => {
          return `[name].js`
        },
      })
    },
    resolveId: (specifier, importer = projectDirectoryUrl) => {
      if (specifier === EMPTY_CHUNK_URL) {
        return specifier
      }
      if (isFileSystemPath(importer)) {
        importer = pathToFileURL(importer).href
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
      if (rollupId === EMPTY_CHUNK_URL) {
        return ""
      }
      const fileUrl = pathToFileURL(rollupId).href
      const urlInfo = projectGraph.urlInfos[fileUrl]
      return {
        code: urlInfo.content,
        map: urlInfo.sourcemap,
      }
    },
    renderDynamicImport: ({ moduleId }) => {
      urlsReferencedByJs.push(pathToFileURL(moduleId).href)
      return {
        left: "import(window.__asVersionedSpecifier__(",
        right: "), import.meta.url)",
      }
    },
    renderChunk: (code, chunkInfo) => {
      const { facadeModuleId } = chunkInfo
      if (!facadeModuleId) {
        // happens for inline module scripts for instance
        return null
      }
      if (facadeModuleId === EMPTY_CHUNK_URL) {
        return null
      }
      return null
    },
  }
}
