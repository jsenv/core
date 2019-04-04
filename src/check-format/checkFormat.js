import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { prettiest } from "/node_modules/@dmail/prettiest/index.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

// required until @jsenv/core importMap gets fixed
const { namedValueDescriptionToMetaDescription, selectAllFileInsideFolder } = import.meta.require(
  "@dmail/project-structure",
)

export const checkFormat = ({ projectFolder, formattableDescription }) =>
  catchAsyncFunctionCancellation(async () => {
    projectFolder = normalizePathname(projectFolder)
    const cancellationToken = createProcessInterruptionCancellationToken()

    const filenameRelativeArray = await selectAllFileInsideFolder({
      cancellationToken,
      pathname: projectFolder,
      metaDescription: namedValueDescriptionToMetaDescription({
        formattable: formattableDescription,
      }),
      predicate: (meta) => meta.formattable === true,
      transformFile: ({ filenameRelative }) => filenameRelative,
    })

    return prettiest({
      cancellationToken,
      folder: projectFolder,
      filenameRelativeArray: filenameRelativeArray.sort(),
    })
  })
