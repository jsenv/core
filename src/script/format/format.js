import { prettiest } from "@dmail/prettiest"
import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const format = catchAsyncFunctionCancellation(
  async ({ localRoot, formatPatternMapping }) => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const metaMap = patternGroupToMetaMap({
      format: formatPatternMapping,
    })

    const ressources = await forEachRessourceMatching({
      cancellationToken,
      localRoot,
      metaMap,
      predicate: (meta) => meta.format === true,
    })

    return prettiest({ cancellationToken, localRoot, ressources })
  },
)
