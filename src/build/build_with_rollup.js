/*
 * we will log something like
 *
 */

import { fileURLToPath, pathToFileURL } from "node:url"
import { isFileSystemPath } from "@jsenv/filesystem"
import { createLog, startSpinner, UNICODE } from "@jsenv/log"

import { msAsDuration } from "@jsenv/core/src/utils/logs/duration_log.js"

import { applyRollupPlugins } from "./apply_rollup_plugins.js"
import { applyLeadingSlashUrlResolution } from "../omega/kitchen/leading_slash_url_resolution.js"

export const buildWithRollup = async ({
  signal,
  logger,
  projectDirectoryUrl,
  buildDirectoryUrl,
  buildUrlsGenerator,
  projectGraph,
  jsModulesToBuild,

  runtimeSupport,
  sourcemapInjection,
}) => {
  const buildingLog = createLog()
  const startMs = Date.now()
  const spinner = startSpinner({
    log: buildingLog,
    text: `Building js moduels with rollup`,
  })
  const resultRef = { current: null }
  await applyRollupPlugins({
    rollupPlugins: [
      rollupPluginJsenv({
        signal,
        logger,
        projectDirectoryUrl,
        buildDirectoryUrl,
        buildUrlsGenerator,
        projectGraph,
        jsModulesToBuild,

        runtimeSupport,
        sourcemapInjection,
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
  const msEllapsed = Date.now() - startMs
  spinner.stop(`${UNICODE.OK} rollup build done in ${msAsDuration(msEllapsed)}`)
  return resultRef.current
}

const rollupPluginJsenv = ({
  // logger,
  projectDirectoryUrl,
  buildDirectoryUrl,
  // buildUrlsGenerator,
  projectGraph,
  jsModulesToBuild,

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

  const urlsReferencedByJs = []
  const urlImporters = {}

  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args)

      jsModulesToBuild.forEach((jsModuleInfo) => {
        emitChunk(jsModuleInfo)
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
            url = pathToFileURL(facadeModuleId).href
          } else {
            const { sources } = rollupFileInfo.map
            const sourcePath = sources[sources.length - 1]
            url = pathToFileURL(sourcePath).href
          }
          jsModuleInfos[url] = {
            buildRelativeUrl: rollupFileInfo.fileName,
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
        dir: fileURLToPath(buildDirectoryUrl),
        entryFileNames: () => {
          return `[name].js`
        },
        chunkFileNames: () => {
          return `[name].js?v=[hash]`
        },
      })
    },
    resolveId: (specifier, importer = projectDirectoryUrl) => {
      if (isFileSystemPath(importer)) {
        importer = pathToFileURL(importer).href
      }
      const url =
        applyLeadingSlashUrlResolution(specifier, projectDirectoryUrl) ||
        new URL(specifier, importer).href
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
      const fileUrl = pathToFileURL(rollupId).href
      const urlInfo = projectGraph.getUrlInfo(fileUrl)
      return {
        code: urlInfo.content,
        map: urlInfo.sourcemap,
      }
    },
    resolveFileUrl: ({ moduleId, referenceId }) => {
      const url = pathToFileURL(moduleId).href
      urlsReferencedByJs.push(url)
      console.log("resolve file url for", url, "referenced by", referenceId)
      return `window.__asVersionedSpecifier__("${true}")`
    },
    renderDynamicImport: ({ facadeModuleId }) => {
      const url = pathToFileURL(facadeModuleId).href
      urlsReferencedByJs.push(url)
      console.log("render dynamic import", url)
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
      return null
    },
  }
}
