import {
  urlToFileSystemPath,
  ensureEmptyDirectory,
  readFile,
  urlToRelativeUrl,
  writeFile,
  resolveUrl,
} from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { buildServiceWorker } from "@jsenv/core/src/internal/building/buildServiceWorker.js"
import { humanizeUrl } from "@jsenv/core/src/internal/building/url_trace.js"
import {
  isNodePartOfSupportedRuntimes,
  isBrowserPartOfSupportedRuntimes,
} from "@jsenv/core/src/internal/generateGroupMap/runtime_support.js"
import { featuresCompatMap } from "@jsenv/core/src/internal/generateGroupMap/featuresCompatMap.js"
import { createRuntimeCompat } from "@jsenv/core/src/internal/generateGroupMap/runtime_compat.js"
import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin.js"

export const buildUsingRollup = async ({
  buildOperation,
  logger,

  projectDirectoryUrl,
  entryPointMap,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  buildDirectoryUrl,
  buildDirectoryClean,
  assetManifestFile = false,
  assetManifestFileRelativeUrl,
  sourcemapExcludeSources,
  writeOnFileSystem,

  format,
  systemJsUrl,
  globalName,
  globals,
  babelPluginMap,
  runtimeSupport,
  transformTopLevelAwait,

  urlMappings,
  importResolutionMethod,
  importMapFileRelativeUrl,
  importDefaultExtension,
  externalImportSpecifiers,
  externalImportUrlPatterns,
  importPaths,

  urlVersioning,
  urlVersionningForEntryPoints,
  lineBreakNormalization,
  jsConcatenation,
  cssConcatenation,
  useImportMapToMaximizeCacheReuse,
  preserveEntrySignatures,
  treeshake,

  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,

  serviceWorkers,
  serviceWorkerFinalizer,
}) => {
  const node = isNodePartOfSupportedRuntimes(runtimeSupport)
  const browser = isBrowserPartOfSupportedRuntimes(runtimeSupport)

  const runtimeCompatMap = createRuntimeCompat({
    runtimeSupport,
    pluginMap: {
      import_assertion_type_json: true,
      import_assertion_type_css: true,
    },
    pluginCompatMap: featuresCompatMap,
  })
  const importAssertionsSupport = {
    json:
      format === "esmodule" &&
      !runtimeCompatMap.pluginRequiredNameArray.includes(
        "import_assertion_type_json",
      ),
    css:
      format === "esmodule" &&
      !runtimeCompatMap.pluginRequiredNameArray.includes(
        "import_assertion_type_json",
      ),
  }

  const {
    jsenvRollupPlugin,
    getLastErrorMessage,
    getResult,
    asOriginalUrl,
    asProjectUrl,
  } = await createJsenvRollupPlugin({
    buildOperation,
    logger,

    projectDirectoryUrl,
    entryPointMap,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
    buildDirectoryUrl,

    format,
    systemJsUrl,
    babelPluginMap,
    transformTopLevelAwait,
    node,
    browser,
    importAssertionsSupport,

    urlMappings,
    importResolutionMethod,
    importMapFileRelativeUrl,
    importDefaultExtension,
    externalImportSpecifiers,
    externalImportUrlPatterns,
    importPaths,

    urlVersioning,
    urlVersionningForEntryPoints,
    lineBreakNormalization,
    jsConcatenation,
    cssConcatenation,
    useImportMapToMaximizeCacheReuse,

    minify,
    minifyJsOptions,
    minifyCssOptions,
    minifyHtmlOptions,
  })

  try {
    await useRollup({
      buildOperation,
      logger,

      jsenvRollupPlugin,
      format,
      globals,
      globalName,
      sourcemapExcludeSources,
      preserveEntrySignatures,
      treeshake,
      // jsConcatenation,
      buildDirectoryUrl,
      buildDirectoryClean,

      asOriginalUrl,
    })
  } catch (e) {
    if (e.plugin === "jsenv") {
      const jsenvPluginErrorMessage = getLastErrorMessage()
      if (jsenvPluginErrorMessage) {
        e.message = jsenvPluginErrorMessage
      }
      throw e
    }
    if (e.code === "MISSING_EXPORT") {
      let message = e.message
      message = message.replace(e.id, (url) =>
        humanizeUrl(asOriginalUrl(url) || url),
      )
      message = message.replace(/(www|http:|https:)+[^\s]+[\w]/g, (url) =>
        humanizeUrl(asOriginalUrl(url) || url),
      )
      const importedFileRollupUrl = e.message.match(/not exported by (.*?),/)[1]
      const convertSuggestion = await getConvertSuggestion({
        importedFileRollupUrl,
        asProjectUrl,
        asOriginalUrl,
        projectDirectoryUrl,
      })
      const detailedMessage = createDetailedMessage(message, {
        frame: e.frame,
        ...convertSuggestion,
      })
      throw new Error(detailedMessage, { cause: e })
    }
    throw e
  }

  const {
    rollupBuild,
    urlResponseBodyMap,
    buildMappings,
    buildManifest,
    buildImportMap,
    buildFileContents,
    buildInlineFileContents,
    buildStats,
  } = getResult()

  if (writeOnFileSystem) {
    if (buildDirectoryClean) {
      await ensureEmptyDirectory(buildDirectoryUrl)
    }

    if (assetManifestFile) {
      const assetManifestFileUrl = resolveUrl(
        assetManifestFileRelativeUrl,
        buildDirectoryUrl,
      )
      await writeFile(
        assetManifestFileUrl,
        JSON.stringify(buildManifest, null, "  "),
      )
    }

    const buildRelativeUrls = Object.keys(buildFileContents)
    await Promise.all(
      buildRelativeUrls.map(async (buildRelativeUrl) => {
        const fileBuildUrl = resolveUrl(buildRelativeUrl, buildDirectoryUrl)
        await writeFile(fileBuildUrl, buildFileContents[buildRelativeUrl])
      }),
    )

    await Promise.all(
      Object.keys(serviceWorkers).map(
        async (serviceWorkerProjectRelativeUrl) => {
          const serviceWorkerBuildRelativeUrl =
            serviceWorkers[serviceWorkerProjectRelativeUrl]
          await buildServiceWorker({
            projectDirectoryUrl,
            buildDirectoryUrl,
            serviceWorkerProjectRelativeUrl,
            serviceWorkerBuildRelativeUrl,
            serviceWorkerTransformer: (code) =>
              serviceWorkerFinalizer(code, {
                buildManifest,
                rollupBuild,
                lineBreakNormalization,
              }),

            minify,
          })
        },
      ),
    )
  }

  return {
    rollupBuild,
    urlResponseBodyMap,
    buildMappings,
    buildManifest,
    buildImportMap,
    buildFileContents,
    buildInlineFileContents,
    buildStats,
  }
}

const useRollup = async ({
  buildOperation,
  logger,
  jsenvRollupPlugin,
  format,
  globals,
  globalName,
  sourcemapExcludeSources,
  preserveEntrySignatures,
  treeshake,
  // jsConcatenation,
  buildDirectoryUrl,
  asOriginalUrl,
}) => {
  buildOperation.throwIfAborted()
  const { rollup } = await import("rollup")
  const { importAssertions } = await import("acorn-import-assertions")

  const rollupInputOptions = {
    // about cache here, we should/could reuse previous rollup call
    // to get the cache from the entryPointMap
    // as shown here: https://rollupjs.org/guide/en#cache
    // it could be passed in arguments to this function
    // however parallelism and having different rollup options per
    // call make it a bit complex
    // cache: null
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    //  experimentalTopLevelAwait: true,
    // if we want to ignore some warning
    // please use https://rollupjs.org/guide/en#onwarn
    // to be very clear about what we want to ignore
    onwarn: (warning) => {
      if (warning.code === "THIS_IS_UNDEFINED") {
        return
      }
      if (
        warning.code === "EMPTY_BUNDLE" &&
        warning.chunkName === "__empty__"
      ) {
        return
      }
      // ignore file name conflict when sourcemap or importmap are re-emitted
      if (
        warning.code === "FILE_NAME_CONFLICT" &&
        (warning.message.includes(".map") ||
          warning.message.includes(".importmap"))
      ) {
        return
      }
      warning.message = warning.message.replace(
        /http:\/\/jsenv.com\/[^\s]+[\w]/g,
        (url) => {
          return humanizeUrl(asOriginalUrl(url) || url)
        },
      )
      if (warning.code === "CIRCULAR_DEPENDENCY") {
        warning.cycle.forEach((url, index) => {
          warning.cycle[index] = humanizeUrl(asOriginalUrl(url) || url)
        })
      }
      logger.warn(String(warning))
    },
    // on passe input: [] car c'est le plugin jsenv qui se chargera d'emit des chunks
    // en fonction de entryPointMap
    // on fait cela car sinon rollup est pénible si on passe un input de type html
    input: [],
    preserveEntrySignatures,
    treeshake,
    plugins: [jsenvRollupPlugin],
    acornInjectPlugins: [importAssertions],
  }
  const rollupOutputOptions = {
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    // experimentalTopLevelAwait: true,
    // we could put prefConst to true by checking 'transform-block-scoping'
    // presence in babelPluginMap
    preferConst: false,
    // https://rollupjs.org/guide/en#output-dir
    dir: urlToFileSystemPath(buildDirectoryUrl),
    // https://rollupjs.org/guide/en#output-format
    format: formatToRollupFormat(format),
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources,
    // preserveModules: !jsConcatenation,
    ...(format === "global"
      ? {
          globals,
          name: globalName,
        }
      : {}),
  }

  buildOperation.throwIfAborted()
  const rollupReturnValue = await rollup(rollupInputOptions)

  buildOperation.throwIfAborted()
  const rollupOutputArray = await rollupReturnValue.generate(
    rollupOutputOptions,
  )

  return rollupOutputArray
}

const formatToRollupFormat = (format) => {
  if (format === "global") return "iife"
  if (format === "commonjs") return "cjs"
  if (format === "systemjs") return "system"
  if (format === "esmodule") return "esm"
  throw new Error(`unexpected format, got ${format}`)
}

const getConvertSuggestion = async ({
  importedFileRollupUrl,
  asProjectUrl,
  asOriginalUrl,
  projectDirectoryUrl,
}) => {
  const importedFileUrl = asProjectUrl(importedFileRollupUrl)
  const importedFileContent = await readFile(importedFileUrl)
  const looksLikeCommonJs =
    importedFileContent.includes("module.exports = ") ||
    importedFileContent.includes("exports.")

  if (!looksLikeCommonJs) {
    return null
  }

  const importerFileOriginalUrl = asOriginalUrl(importedFileUrl)
  const importedFileOriginalRelativeUrl = urlToRelativeUrl(
    importerFileOriginalUrl,
    projectDirectoryUrl,
  )
  return {
    suggestion: `The file seems written in commonjs, you should use "customCompiler" to convert it to js module
{
  "./${importedFileOriginalRelativeUrl}": commonJsToJavaScriptModule
}
As documented in https://github.com/jsenv/jsenv-core/blob/master/docs/shared-parameters.md#customcompilers`,
  }
}
