import { pathToFileURL } from "node:url"

import { URL_META } from "@jsenv/url-meta"
import { isFileSystemPath } from "@jsenv/urls"
import { createDetailedMessage } from "@jsenv/log"
import { babelHelperNameFromUrl } from "@jsenv/babel-plugins"
import { sourcemapConverter } from "@jsenv/sourcemap"

import { fileUrlConverter } from "@jsenv/core/src/omega/file_url_converter.js"

const globalThisClientFileUrl = new URL(
  "../../transpilation/babel/global_this/client/global_this.js",
  import.meta.url,
).href
const newStylesheetClientFileUrl = new URL(
  "../../transpilation/babel/new_stylesheet/client/new_stylesheet.js",
  import.meta.url,
).href
const regeneratorRuntimeClientFileUrl = new URL(
  "../../transpilation/babel/regenerator_runtime/client/regenerator_runtime.js",
  import.meta.url,
).href

export const bundleJsModules = async ({
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
  const {
    babelHelpersChunk = true,
    include,
    preserveDynamicImport = false,
  } = options
  const { jsModuleBundleUrlInfos } = await buildWithRollup({
    signal,
    logger,
    rootDirectoryUrl,
    buildDirectoryUrl,
    urlGraph,
    jsModuleUrlInfos,

    runtimeCompat,
    sourcemaps,

    include,
    babelHelpersChunk,
    preserveDynamicImport,
  })
  return jsModuleBundleUrlInfos
}

const rollupPluginJsenv = ({
  // logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  urlGraph,
  jsModuleUrlInfos,
  sourcemaps,

  include,
  babelHelpersChunk,
  preserveDynamicImport,

  resultRef,
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented")
  }
  const format = jsModuleUrlInfos.some((jsModuleUrlInfo) =>
    jsModuleUrlInfo.filename.endsWith(".cjs"),
  )
    ? "cjs"
    : "esm"
  const emitChunk = (chunk) => {
    return _rollupEmitFile({
      type: "chunk",
      ...chunk,
    })
  }
  let importCanBeBundled = () => true
  if (include) {
    const associations = URL_META.resolveAssociations(
      { bundle: include },
      rootDirectoryUrl,
    )
    importCanBeBundled = (url) => {
      return URL_META.applyAssociations({ url, associations }).bundle
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
        if (jsModuleUrlInfo.isEntryPoint) {
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
          // preserveSignature: "allow-extension",
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
          let url
          if (rollupFileInfo.facadeModuleId) {
            url = fileUrlConverter.asFileUrl(rollupFileInfo.facadeModuleId)
          } else {
            url = new URL(rollupFileInfo.fileName, buildDirectoryUrl).href
          }
          const jsModuleBundleUrlInfo = {
            url,
            originalUrl: url,
            type: format === "esm" ? "js_module" : "common_js",
            data: {
              generatedBy: "rollup",
              bundleRelativeUrl: rollupFileInfo.fileName,
              usesImport:
                rollupFileInfo.imports.length > 0 ||
                rollupFileInfo.dynamicImports.length > 0,
            },
            contentType: "text/javascript",
            content: rollupFileInfo.code,
            sourcemap: rollupFileInfo.map,
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
        format,
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
          if (babelHelpersChunk) {
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
            if (fileUrl === globalThisClientFileUrl) {
              return "babel_helpers"
            }
            if (fileUrl === newStylesheetClientFileUrl) {
              return "babel_helpers"
            }
            if (fileUrl === regeneratorRuntimeClientFileUrl) {
              return "babel_helpers"
            }
          }
          return null
        },
        // https://rollupjs.org/guide/en/#outputpaths
        // paths: (id) => {
        //   return id
        // },
      })
    },
    // https://rollupjs.org/guide/en/#resolvedynamicimport
    resolveDynamicImport: (specifier, importer) => {
      if (preserveDynamicImport) {
        let urlObject
        if (specifier[0] === "/") {
          urlObject = new URL(specifier.slice(1), rootDirectoryUrl)
        } else {
          urlObject = new URL(specifier, importer)
        }
        urlObject.searchParams.set("as_js_classic_library", "")
        return { external: true, id: urlObject.href }
      }
      return null
    },
    resolveId: (specifier, importer = rootDirectoryUrl) => {
      if (isFileSystemPath(importer)) {
        importer = fileUrlConverter.asFileUrl(importer)
      }
      let url
      if (specifier[0] === "/") {
        url = new URL(specifier.slice(1), rootDirectoryUrl).href
      } else {
        url = new URL(specifier, importer).href
      }
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
      if (!urlInfo) {
        // happen when excluded by urlAnalysis.include
        return { id: url, external: true }
      }
      if (!urlInfo.shouldHandle) {
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

const buildWithRollup = async ({
  signal,
  logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  urlGraph,
  jsModuleUrlInfos,

  runtimeCompat,
  sourcemaps,

  include,
  babelHelpersChunk,
  preserveDynamicImport,
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
          include,
          babelHelpersChunk,
          preserveDynamicImport,
          resultRef,
        }),
      ],
      inputOptions: {
        input: [],
        onwarn: (warning) => {
          if (warning.code === "CIRCULAR_DEPENDENCY") {
            return
          }
          if (
            warning.code === "THIS_IS_UNDEFINED" &&
            pathToFileURL(warning.id).href === globalThisClientFileUrl
          ) {
            return
          }
          if (warning.code === "EVAL") {
            // ideally we should disable only for jsenv files
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

const applyRollupPlugins = async ({
  rollupPlugins,
  inputOptions = {},
  outputOptions = {},
}) => {
  const { rollup } = await import("rollup")
  const { importAssertions } = await import("acorn-import-assertions")
  const rollupReturnValue = await rollup({
    ...inputOptions,
    plugins: rollupPlugins,
    acornInjectPlugins: [
      importAssertions,
      ...(inputOptions.acornInjectPlugins || []),
    ],
  })
  const rollupOutputArray = await rollupReturnValue.generate(outputOptions)
  return rollupOutputArray
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
  if (!jsModuleUrlInfo.isEntryPoint) {
    // not an entry point, jsenv will put it inside js/ directory
    return true
  }
  return false
}
