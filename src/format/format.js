import { prettiest } from "@dmail/prettiest"
import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} from "@dmail/project-structure"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const format = ({ projectFolder, formatDescription }) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const filenameRelativeArray = await selectAllFileInsideFolder({
      cancellationToken,
      pathname: projectFolder,
      metaDescription: namedValueDescriptionToMetaDescription({
        format: formatDescription,
      }),
      predicate: (meta) => meta.format === true,
      transformFile: ({ filenameRelative }) => filenameRelative,
    })

    return prettiest({
      cancellationToken,
      folder: projectFolder,
      filenameRelativeArray: filenameRelativeArray.sort(),
    })
  })
