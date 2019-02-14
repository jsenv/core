import { rollup } from "rollup"
import { createOperation } from "@dmail/cancellation"

export const bundleWithRollup = async ({
  cancellationToken,
  rollupParseOptions,
  rollupGenerateOptions,
}) => {
  const rollupBundle = await createOperation({
    cancellationToken,
    start: () =>
      rollup({
        // about cache here, we should/could reuse previous rollup call
        // to get the cache from the entryPointsDescription
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
        // onwarn: () => {},
        ...rollupParseOptions,
      }),
  })

  const rollupOutputArray = await createOperation({
    cancellationToken,
    start: () =>
      rollupBundle.write({
        // https://rollupjs.org/guide/en#experimentaltoplevelawait
        experimentalTopLevelAwait: true,
        // we could put prefConst to true by checking 'transform-block-scoping'
        // presence in babelPluginDescription
        preferConst: false,
        ...rollupGenerateOptions,
      }),
  })

  return rollupOutputArray
}
