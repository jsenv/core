import {
  isFileSystemPath,
  normalizeStructuredMetaMap,
  urlIsInsideOf,
  urlToMeta,
} from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { applyRollupPlugins } from "@jsenv/utils/js_ast/apply_rollup_plugins.js"
import { sourcemapConverter } from "@jsenv/utils/sourcemap/sourcemap_converter.js"
import { fileUrlConverter } from "@jsenv/core/src/omega/file_url_converter.js"
import { babelHelperNameFromUrl } from "@jsenv/babel-plugins"

const jsenvBabelPluginDirectoryUrl = new URL(
  "../../transpilation/babel/",
  import.meta.url,
).href

export const bundleJsModule = async ({
  jsModuleUrlInfos,
  context,
  options,
}) => {
  const {
    signal,
    logger,
    rootDirectoryUrl,
    buildDirectoryUrl,
    urlGraph,
    runtimeCompat,
    sourcemaps,
  } = context
  const { jsModuleBundleUrlInfos } = await buildWithRollup({
    signal,
    logger,
    rootDirectoryUrl,
    buildDirectoryUrl,
    urlGraph,
    jsModuleUrlInfos,

    runtimeCompat,
    sourcemaps,
    options,
  })
  return jsModuleBundleUrlInfos
}

export const buildWithRollup = async ({
  signal,
  logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  urlGraph,
  jsModuleUrlInfos,

  runtimeCompat,
  sourcemaps,
  options,
}) => {
  const resultRef = { current: null }
  try {
    await applyRollupPlugins({
      rollupPlugins: [
        rollupPluginJsenv({
          signal,
          logger,
          rootDirectoryUrl,
          buildDirectoryUrl,
          urlGraph,
          jsModuleUrlInfos,

          runtimeCompat,
          sourcemaps,
          options,
          resultRef,
        }),
      ],
      inputOptions: {
        input: [],
        onwarn: (warning) => {
          if (warning.code === "CIRCULAR_DEPENDENCY") {
            return
          }
          logger.warn(String(warning))
        },
      },
    })
    return resultRef.current
  } catch (e) {
    if (e.code === "MISSING_EXPORT") {
      const detailedMessage = createDetailedMessage(e.message, {
        frame: e.frame,
      })
      throw new Error(detailedMessage, { cause: e })
    }
    throw e
  }
}

const rollupPluginJsenv = ({
  // logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  urlGraph,
  jsModuleUrlInfos,
  sourcemaps,
  options,

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
  let importCanBeBundled = () => true
  if (options.include) {
    const bundleIncludeConfig = normalizeStructuredMetaMap(
      {
        bundle: options.include,
      },
      rootDirectoryUrl,
    )
    importCanBeBundled = (url) => {
      return urlToMeta({
        url,
        structuredMetaMap: bundleIncludeConfig,
      }).bundle
    }
  }
  const urlImporters = {}

  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args)
      let previousNonEntryPointModuleId
      jsModuleUrlInfos.forEach((jsModuleUrlInfo) => {
        const id = jsModuleUrlInfo.url
        if (jsModuleUrlInfo.data.isEntryPoint) {
          emitChunk({
            id,
          })
          return
        }
        emitChunk({
          id,
          implicitlyLoadedAfterOneOf: previousNonEntryPointModuleId
            ? [previousNonEntryPointModuleId]
            : null,
          preserveSignature: "allow-extension",
        })
        previousNonEntryPointModuleId = id
      })
    },
    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args)

      const jsModuleBundleUrlInfos = {}
      Object.keys(rollupResult).forEach((fileName) => {
        const rollupFileInfo = rollupResult[fileName]
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const jsModuleBundleUrlInfo = {
            data: {
              generatedBy: "rollup",
              bundleRelativeUrl: rollupFileInfo.fileName,
              usesImport:
                rollupFileInfo.imports.length > 0 ||
                rollupFileInfo.dynamicImports.length > 0,
              usesExport: rollupFileInfo.exports.length > 0,
            },
            contentType: "text/javascript",
            content: rollupFileInfo.code,
            sourcemap: rollupFileInfo.map,
          }
          let url
          if (rollupFileInfo.facadeModuleId) {
            url = fileUrlConverter.asFileUrl(rollupFileInfo.facadeModuleId)
          } else {
            url = new URL(rollupFileInfo.fileName, buildDirectoryUrl).href
          }
          jsModuleBundleUrlInfos[url] = jsModuleBundleUrlInfo
        }
      })
      resultRef.current = {
        jsModuleBundleUrlInfos,
      }
    },
    outputOptions: (outputOptions) => {
      // const sourcemapFile = buildDirectoryUrl
      Object.assign(outputOptions, {
        format: "esm",
        dir: fileUrlConverter.asFilePath(buildDirectoryUrl),
        sourcemap: sourcemaps === "file" || sourcemaps === "inline",
        // sourcemapFile,
        sourcemapPathTransform: (relativePath) => {
          return new URL(relativePath, buildDirectoryUrl).href
        },
        entryFileNames: () => {
          return `[name].js`
        },
        chunkFileNames: (chunkInfo) => {
          const insideJs = willBeInsideJsDirectory({
            chunkInfo,
            fileUrlConverter,
            jsModuleUrlInfos,
          })
          let nameFromUrlInfo
          if (chunkInfo.facadeModuleId) {
            const url = fileUrlConverter.asFileUrl(chunkInfo.facadeModuleId)
            const urlInfo = jsModuleUrlInfos.find(
              (jsModuleUrlInfo) => jsModuleUrlInfo.url === url,
            )
            if (urlInfo) {
              nameFromUrlInfo = urlInfo.filename
            }
          }
          const name = nameFromUrlInfo || `${chunkInfo.name}.js`
          return insideJs ? `js/${name}` : `${name}`
        },
        manualChunks: (id) => {
          const fileUrl = fileUrlConverter.asFileUrl(id)
          if (
            fileUrl.endsWith(
              "babel-plugin-transform-async-to-promises/helpers.mjs",
            )
          ) {
            return "babel_helpers"
          }
          if (babelHelperNameFromUrl(fileUrl)) {
            return "babel_helpers"
          }
          if (urlIsInsideOf(fileUrl, jsenvBabelPluginDirectoryUrl)) {
            return "babel_helpers"
          }
          return null
        },
        // https://rollupjs.org/guide/en/#outputpaths
        // paths: (id) => {
        //   return id
        // },
      })
    },
    resolveId: (specifier, importer = rootDirectoryUrl) => {
      if (isFileSystemPath(importer)) {
        importer = fileUrlConverter.asFileUrl(importer)
      }
      const url = new URL(specifier, importer).href
      const existingImporter = urlImporters[url]
      if (!existingImporter) {
        urlImporters[url] = importer
      }
      if (!url.startsWith("file:")) {
        return { id: url, external: true }
      }
      if (!importCanBeBundled(url)) {
        return { id: url, external: true }
      }
      const urlInfo = urlGraph.getUrlInfo(url)
      if (urlInfo && urlInfo.shouldIgnore) {
        return { id: url, external: true }
      }
      const filePath = fileUrlConverter.asFilePath(url)
      return filePath
    },
    async load(rollupId) {
      const fileUrl = fileUrlConverter.asFileUrl(rollupId)
      const urlInfo = urlGraph.getUrlInfo(fileUrl)
      return {
        code: urlInfo.content,
        map: urlInfo.sourcemap
          ? sourcemapConverter.toFilePaths(urlInfo.sourcemap)
          : null,
      }
    },
  }
}

const willBeInsideJsDirectory = ({
  chunkInfo,
  fileUrlConverter,
  jsModuleUrlInfos,
}) => {
  // if the chunk is generated dynamically by rollup
  // for an entry point jsenv will put that file inside js/ directory
  // if it's generated dynamically for a file already in js/ directory
  // both will be inside the js/ directory
  if (!chunkInfo.facadeModuleId) {
    // generated by rollup
    return true
  }
  const url = fileUrlConverter.asFileUrl(chunkInfo.facadeModuleId)
  const jsModuleUrlInfo = jsModuleUrlInfos.find(
    (jsModuleUrlInfo) => jsModuleUrlInfo.url === url,
  )
  if (!jsModuleUrlInfo) {
    // generated by rollup
    return true
  }
  if (
    !jsModuleUrlInfo.data.isEntryPoint &&
    !jsModuleUrlInfo.data.isWebWorkerEntryPoint
  ) {
    // not an entry point, jsenv will put it inside js/ directory
    return true
  }
  return false
}
