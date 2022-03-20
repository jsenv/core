import { isFileSystemPath } from "@jsenv/filesystem"

import { applyRollupPlugins } from "@jsenv/core/src/utils/js_ast/apply_rollup_plugins.js"
import { fileUrlConverter } from "@jsenv/core/src/omega/file_url_converter.js"

export const buildWithRollup = async ({
  signal,
  logger,
  sourceDirectoryUrl,
  buildDirectoryUrl,
  sourceGraph,
  jsModulesUrlsToBuild,

  runtimeSupport,
  sourcemapMethod,
}) => {
  const resultRef = { current: null }
  await applyRollupPlugins({
    rollupPlugins: [
      rollupPluginJsenv({
        signal,
        logger,
        sourceDirectoryUrl,
        buildDirectoryUrl,
        sourceGraph,
        jsModulesUrlsToBuild,

        runtimeSupport,
        sourcemapMethod,
        resultRef,
      }),
    ],
    inputOptions: {
      input: [],
      onwarn: (warning) => {
        logger.warn(String(warning))
      },
    },
  })
  return resultRef.current
}

const rollupPluginJsenv = ({
  // logger,
  sourceDirectoryUrl,
  buildDirectoryUrl,
  sourceGraph,
  jsModulesUrlsToBuild,

  resultRef,
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented")
  }
  const emitChunk = (chunk) => {
    return _rollupEmitFile({
      type: "chunk",
      ...chunk,
    })
  }
  const urlImporters = {}

  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args)
      jsModulesUrlsToBuild.forEach((jsModuleUrl) => {
        // const jsModuleUrlInfo = projectGraph.getUrlInfo(jsModuleUrl)
        emitChunk({
          id: jsModuleUrl,
        })
      })
    },
    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args)

      const jsModuleInfos = {}
      Object.keys(rollupResult).forEach((fileName) => {
        const rollupFileInfo = rollupResult[fileName]
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const { facadeModuleId } = rollupFileInfo
          let url
          if (facadeModuleId) {
            url = fileUrlConverter.asFileUrl(facadeModuleId)
          } else {
            const { sources } = rollupFileInfo.map
            const sourcePath = sources[sources.length - 1]
            url = fileUrlConverter.asFileUrl(sourcePath)
          }
          jsModuleInfos[url] = {
            // buildRelativeUrl: rollupFileInfo.fileName,
            data: { isEntryPoint: rollupFileInfo.isEntry },
            type: "js_module",
            content: rollupFileInfo.code,
            sourcemap: rollupFileInfo.map,
          }
        }
      })
      resultRef.current = {
        jsModuleInfos,
      }
    },
    outputOptions: (outputOptions) => {
      Object.assign(outputOptions, {
        format: "esm",
        dir: fileUrlConverter.asFilePath(buildDirectoryUrl),
        entryFileNames: () => {
          return `[name].js`
        },
        chunkFileNames: () => {
          return `[name].js`
        },
      })
    },
    resolveId: (specifier, importer = sourceDirectoryUrl) => {
      if (isFileSystemPath(importer)) {
        importer = fileUrlConverter.asFileUrl(importer)
      }
      const url = new URL(specifier, importer).href
      const existingImporter = urlImporters[url]
      if (!existingImporter) {
        urlImporters[url] = importer
      }
      if (!url.startsWith("file:")) {
        return { url, external: true }
      }
      return fileUrlConverter.asFilePath(url)
    },
    async load(rollupId) {
      const fileUrl = fileUrlConverter.asFileUrl(rollupId)
      const urlInfo = sourceGraph.getUrlInfo(fileUrl)
      return {
        code: urlInfo.content,
        map: urlInfo.sourcemap,
      }
    },
    renderChunk: (code, chunkInfo) => {
      const { facadeModuleId } = chunkInfo
      if (!facadeModuleId) {
        // happens for inline module scripts for instance
        return null
      }
      return null
    },
  }
}
