import { isFileSystemPath, urlToRelativeUrl } from "@jsenv/filesystem"

import { applyRollupPlugins } from "@jsenv/utils/js_ast/apply_rollup_plugins.js"
import { sourcemapConverter } from "@jsenv/utils/sourcemap/sourcemap_converter.js"
import { fileUrlConverter } from "@jsenv/core/src/omega/file_url_converter.js"

export const jsenvPluginBundleJsModule = () => {
  return {
    name: "jsenv:bundle_js_module",
    appliesDuring: {
      build: true,
    },
    bundle: {
      js_module: async (
        jsModuleUrlInfos,
        {
          signal,
          logger,
          rootDirectoryUrl,
          buildDirectoryUrl,
          urlGraph,
          runtimeCompat,
          sourcemaps,
        },
      ) => {
        const { jsModuleBundleUrlInfos } = await buildWithRollup({
          signal,
          logger,
          rootDirectoryUrl,
          buildDirectoryUrl,
          urlGraph,
          jsModuleUrlInfos,

          runtimeCompat,
          sourcemaps,
        })
        return jsModuleBundleUrlInfos
      },
    },
  }
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
}) => {
  const resultRef = { current: null }
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
}

const rollupPluginJsenv = ({
  // logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  urlGraph,
  jsModuleUrlInfos,
  sourcemaps,

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
            // buildRelativeUrl: rollupFileInfo.fileName,
            data: {
              generatedBy: "rollup",
            },
            contentType: "application/javascript",
            content: rollupFileInfo.code,
            sourcemap: rollupFileInfo.map,
          }
          let url
          if (rollupFileInfo.facadeModuleId) {
            url = fileUrlConverter.asFileUrl(rollupFileInfo.facadeModuleId)
          } else {
            url = new URL(rollupFileInfo.fileName, rootDirectoryUrl).href
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
          // preserves relative path parts:
          // the goal is to maintain the original relative path (relative to the root directory)
          // so that later in the build process, when resolving these urls, we are able to
          // re-resolve the specifier againt the original parent url and find the original url
          if (chunkInfo.facadeModuleId) {
            const fileUrl = fileUrlConverter.asFileUrl(chunkInfo.facadeModuleId)
            const relativePath = urlToRelativeUrl(fileUrl, rootDirectoryUrl)
            return relativePath
          }
          // chunk generated dynamically by rollup to share code.
          // we prefix with "__rollup__/" to avoid potential conflict of filename
          // between this one and a file with the same name existing in the root directory
          return `__rollup__/${chunkInfo.name}.js`
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
        return { url, external: true }
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
          : urlInfo.sourcemap,
      }
    },
    // resolveFileUrl: ({ moduleId }) => {
    //   return `${fileUrlConverter.asFileUrl(moduleId)}`
    // },
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
