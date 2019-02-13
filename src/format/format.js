import { prettiest } from "@dmail/prettiest"
import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const format = ({ projectFolder, formatDescription }) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const metaMap = patternGroupToMetaMap({
      format: formatDescription,
    })

    const ressources = await forEachRessourceMatching({
      cancellationToken,
      localRoot: projectFolder,
      metaMap,
      predicate: (meta) => meta.format,
    })

    return prettiest({ cancellationToken, localRoot: projectFolder, ressources })
  })
