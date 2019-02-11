import { rollup } from "rollup"
import { createOperation } from "@dmail/cancellation"

export const writeRollupBundle = async ({ cancellationToken, inputOptions, outputOptions }) => {
  const rollupBundle = await createOperation({
    cancellationToken,
    start: () => rollup(inputOptions),
  })

  const result = await createOperation({
    cancellationToken,
    start: () => rollupBundle.write(outputOptions),
  })

  return result
}
