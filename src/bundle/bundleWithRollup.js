import { rollup } from "rollup"
import { createOperation } from "@dmail/cancellation"

export const bundleWithRollup = async ({
  cancellationToken,
  rollupParseOptions,
  rollupGenerateOptions,
  verbose = false,
}) => {
  const log = verbose ? (...args) => console.log(...args) : () => {}

  log(`parse with rollup`)
  log(rollupParseOptions)

  const rollupBundle = await createOperation({
    cancellationToken,
    start: () =>
      rollup({
        // about cache here, we should/could reuse previous rollup call
        // to get the cache from the entryPointsDescription
        // as shown here: https://rollupjs.org/guide/en#cache
        // it could be computed in generateEntryPointsFoldersForPlatform
        // and passed to this function as optional argument
        // cache: null
        // https://rollupjs.org/guide/en#experimentaltoplevelawait
        experimentalTopLevelAwait: true,
        // here we should update onwarn according to https://rollupjs.org/guide/en#onwarn
        // to be very clear about what we want to ignore
        onwarn: () => {},
        ...rollupParseOptions,
      }),
  })

  log(`generate with rollup`)
  log(rollupGenerateOptions)

  const rollupOutputArray = await createOperation({
    cancellationToken,
    start: () =>
      rollupBundle.write({
        // https://rollupjs.org/guide/en#experimentaltoplevelawait
        experimentalTopLevelAwait: true,
        // by checking 'block-scoping' presence in babelPluginDescription
        preferConst: false,
        ...rollupGenerateOptions,
      }),
  })

  return rollupOutputArray
}
