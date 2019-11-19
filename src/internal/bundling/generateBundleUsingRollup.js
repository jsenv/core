import { createOperation } from "@jsenv/cancellation"
import { fileUrlToPath } from "internal/urlUtils.js"
import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin/createJsenvRollupPlugin.js"

const { rollup } = import.meta.require("rollup")

export const generateBundleUsingRollup = async ({
  cancellationToken,
  logger,
  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
  importDefaultExtension,
  compileServer,
  compileDirectoryServerUrl,
  babelPluginMap,
  nativeModulePredicate,
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
    importDefaultExtension,
    compileServer,
    compileDirectoryServerUrl,
    babelPluginMap,
    format,
    minify,
  })
  const rollupParseOptions = {
    input: entryPointMap,
    external: (id) => nativeModulePredicate(id),
    plugins: [jsenvRollupPlugin],
  }
  const rollupGenerateOptions = {
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

  logger.info(`
generating bundle for entry points
--- format ---
${format}
--- entry point map ---
${JSON.stringify(entryPointMap, null, "  ")}
--- into ---
${rollupGenerateOptions.dir}
`)

  const rollupBundle = await useRollup({
    cancellationToken,
    writeOnFileSystem,
    rollupParseOptions,
    rollupGenerateOptions,
  })

  return {
    rollupBundle,
    ...getExtraInfo(),
  }
}

const formatToRollupFormat = (format) => {
  if (format === "global") return "iife"
  if (format === "commonjs") return "cjs"
  if (format === "systemjs") return "system"
  throw new Error(`unexpected format, got ${format}`)
}

const useRollup = async ({
  cancellationToken,
  rollupParseOptions,
  rollupGenerateOptions,
  writeOnFileSystem,
}) => {
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
        ...rollupParseOptions,
      }),
  })

  const rollupOutputArray = await createOperation({
    cancellationToken,
    start: () => {
      if (writeOnFileSystem) {
        return rollupBundle.write({
          // https://rollupjs.org/guide/en#experimentaltoplevelawait
          experimentalTopLevelAwait: true,
          // we could put prefConst to true by checking 'transform-block-scoping'
          // presence in babelPluginMap
          preferConst: false,
          ...rollupGenerateOptions,
        })
      }
      return rollupBundle.generate({
        // https://rollupjs.org/guide/en#experimentaltoplevelawait
        experimentalTopLevelAwait: true,
        // we could put prefConst to true by checking 'transform-block-scoping'
        // presence in babelPluginMap
        preferConst: false,
        ...rollupGenerateOptions,
      })
    },
  })

  return rollupOutputArray
}
