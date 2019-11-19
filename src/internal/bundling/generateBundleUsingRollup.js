import { createOperation } from "@jsenv/cancellation"

const { rollup } = import.meta.require("rollup")

export const generateBundleUsingRollup = async ({
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
