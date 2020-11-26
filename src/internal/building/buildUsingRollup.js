import { createOperation } from "@jsenv/cancellation"
import { urlToFileSystemPath, ensureEmptyDirectory } from "@jsenv/util"
import { require } from "../require.js"
import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin.js"

export const buildUsingRollup = async ({
  cancellationToken,
  logger,

  entryPointMap,
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,
  externalImportSpecifiers,
  externalImportUrlPatterns,
  babelPluginMap,
  node,
  browser,

  format,
  systemJsUrl,
  globals,
  globalName,
  sourcemapExcludeSources,

  buildDirectoryUrl,
  buildDirectoryClean,

  longTermCaching,
  useImportMapToImproveLongTermCaching,
  preserveEntrySignatures,
  jsConcatenation,
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  manifestFile = false,

  writeOnFileSystem,
}) => {
  const { jsenvRollupPlugin, getResult } = await createJsenvRollupPlugin({
    cancellationToken,
    logger,

    entryPointMap,
    projectDirectoryUrl,
    importMapFileRelativeUrl,
    compileDirectoryRelativeUrl,
    compileServerOrigin,
    importDefaultExtension,
    externalImportSpecifiers,
    externalImportUrlPatterns,
    babelPluginMap,
    node,
    browser,

    format,
    systemJsUrl,
    buildDirectoryUrl,

    longTermCaching,
    useImportMapToImproveLongTermCaching,
    minify,
    minifyJsOptions,
    minifyCssOptions,
    minifyHtmlOptions,

    manifestFile,
    writeOnFileSystem,
  })

  await useRollup({
    cancellationToken,
    logger,

    entryPointMap,
    jsenvRollupPlugin,

    format,
    globals,
    globalName,
    sourcemapExcludeSources,
    preserveEntrySignatures,
    jsConcatenation,
    buildDirectoryUrl,
    buildDirectoryClean,
  })

  return getResult()
}

const useRollup = async ({
  cancellationToken,
  logger,

  entryPointMap,
  jsenvRollupPlugin,
  format,
  globals,
  globalName,
  sourcemapExcludeSources,
  preserveEntrySignatures,
  // jsConcatenation,
  buildDirectoryUrl,
  buildDirectoryClean,
}) => {
  const { rollup } = require("rollup")

  logger.info(`parse bundle
--- entry point map ---
${JSON.stringify(entryPointMap, null, "  ")}`)

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
    onwarn: (warning, warn) => {
      if (warning.code === "THIS_IS_UNDEFINED") return
      if (warning.code === "EMPTY_BUNDLE" && warning.chunkName === "__empty__") return
      // ignore file name conflict when sourcemap or importmap are re-emitted
      if (
        warning.code === "FILE_NAME_CONFLICT" &&
        (warning.message.includes(".map") || warning.message.includes(".importmap"))
      ) {
        return
      }
      warn(warning)
    },
    // on passe input: [] car c'est le plusign jsenv qui se chargera d'emit des chunks
    // en fonction de entryPointMap
    // on fait cela car sinon rollup est pénible si on passe un entry point map de type html
    input: [],
    preserveEntrySignatures,
    plugins: [jsenvRollupPlugin],
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

  const rollupBundle = await createOperation({
    cancellationToken,
    start: () => rollup(rollupInputOptions),
  })

  if (buildDirectoryClean) {
    await ensureEmptyDirectory(buildDirectoryUrl)
  }

  const rollupOutputArray = await createOperation({
    cancellationToken,
    start: () => rollupBundle.generate(rollupOutputOptions),
  })

  return rollupOutputArray
}

const formatToRollupFormat = (format) => {
  if (format === "global") return "iife"
  if (format === "commonjs") return "cjs"
  if (format === "systemjs") return "system"
  if (format === "esmodule") return "esm"
  throw new Error(`unexpected format, got ${format}`)
}
