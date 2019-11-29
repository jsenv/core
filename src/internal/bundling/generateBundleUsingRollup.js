import { createOperation } from "@jsenv/cancellation"
import { fileUrlToPath } from "internal/urlUtils.js"
import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin/createJsenvRollupPlugin.js"
import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"

const { rollup } = import.meta.require("rollup")

export const generateBundleUsingRollup = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,
  importReplaceMap,
  importFallbackMap,

  node,
  browser,
  babelPluginMap,
  format,
  formatOutputOptions,
  minify,
  sourcemapExcludeSources,
  writeOnFileSystem,
}) => {
  const { jsenvRollupPlugin, getExtraInfo } = await createJsenvRollupPlugin({
    cancellationToken,
    logger,

    projectDirectoryUrl,
    entryPointMap,
    bundleDirectoryUrl,
    compileDirectoryRelativeUrl,
    compileServerOrigin,
    compileServerImportMap,
    importDefaultExtension,

    babelPluginMap,
    format,
    minify,
  })

  const rollupBundle = await useRollup({
    cancellationToken,
    logger,

    entryPointMap,
    node,
    browser,
    jsenvRollupPlugin,

    format,
    formatOutputOptions,
    bundleDirectoryUrl,
    sourcemapExcludeSources,
    writeOnFileSystem,
  })

  const { moduleContentMap, ...rest } = getExtraInfo()
  // could add an other moduleContentMap
  // here take into acount
  // importReplaceMap and importFallbackMap
  // and populate moduleContentMap with it
  // (using same strat that inside jsenv rollup plugin)
  // or just pass it to jsenv rollup plugin that will do his stuff

  return {
    rollupBundle,
    moduleContentMap,
    ...rest,
  }
}

const useRollup = async ({
  cancellationToken,
  logger,

  entryPointMap,
  node,
  browser,
  jsenvRollupPlugin,

  format,
  formatOutputOptions,
  bundleDirectoryUrl,
  sourcemapExcludeSources,
  writeOnFileSystem,
}) => {
  logger.info(`
parse bundle
--- entry point map ---
${JSON.stringify(entryPointMap, null, "  ")}
`)

  const nativeModulePredicate = (specifier) => {
    if (node && isBareSpecifierForNativeNodeModule(specifier)) return true
    // for now browser have no native module
    // and we don't know how we will handle that
    if (browser) return false
    return false
  }

  const rollupBundle = await createOperation({
    cancellationToken,
    start: () =>
      rollup({
        // about cache here, we should/could reuse previous rollup call
        // to get the cache from the entryPointMap
        // as shown here: https://rollupjs.org/guide/en#cache
        // it could be passed in arguments to this function
        // however parallelism and having different rollup options per
        // call make it a bit complex
        // cache: null
        // https://rollupjs.org/guide/en#experimentaltoplevelawait
        experimentalTopLevelAwait: true,
        // if we want to ignore some warning
        // please use https://rollupjs.org/guide/en#onwarn
        // to be very clear about what we want to ignore
        onwarn: (warning, warn) => {
          if (warning.code === "THIS_IS_UNDEFINED") return
          warn(warning)
        },
        input: entryPointMap,
        external: (id) => nativeModulePredicate(id),
        plugins: [jsenvRollupPlugin],
      }),
  })

  const rollupGenerateOptions = {
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    experimentalTopLevelAwait: true,
    // we could put prefConst to true by checking 'transform-block-scoping'
    // presence in babelPluginMap
    preferConst: false,
    // https://rollupjs.org/guide/en#output-dir
    dir: fileUrlToPath(bundleDirectoryUrl),
    // https://rollupjs.org/guide/en#output-format
    format: formatToRollupFormat(format),
    // entryFileNames: `./[name].js`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources,
    ...formatOutputOptions,
  }

  const rollupOutputArray = await createOperation({
    cancellationToken,
    start: () => {
      if (writeOnFileSystem) {
        logger.info(`write bundle at ${rollupGenerateOptions.dir}`)
        return rollupBundle.write(rollupGenerateOptions)
      }
      logger.info("generate bundle")
      return rollupBundle.generate(rollupGenerateOptions)
    },
  })

  return rollupOutputArray
}

const formatToRollupFormat = (format) => {
  if (format === "global") return "iife"
  if (format === "commonjs") return "cjs"
  if (format === "systemjs") return "system"
  throw new Error(`unexpected format, got ${format}`)
}
