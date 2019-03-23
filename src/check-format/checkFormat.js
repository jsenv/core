import { prettiest } from "@dmail/prettiest"
import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} from "@dmail/project-structure"
import { normalizePathname } from "@jsenv/module-resolution"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const checkFormat = ({ projectFolder, formattableDescription }) =>
  catchAsyncFunctionCancellation(async () => {
    projectFolder = normalizePathname(projectFolder)
    const cancellationToken = createProcessInterruptionCancellationToken()

    const filenameRelativeArray = await selectAllFileInsideFolder({
      cancellationToken,
      pathname: projectFolder,
      metaDescription: namedValueDescriptionToMetaDescription({
        format: formattableDescription,
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
