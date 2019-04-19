import { ROOT_FOLDER } from "./ROOT_FOLDER.js"

export const filenameRelativeInception = ({ projectFolder, filenameRelative }) => {
  const projectIsJsenv = projectFolder === ROOT_FOLDER
  const filenameRelativeIsInternal = filenameRelative.startsWith(`node_modules/@jsenv/core/`)

  if (projectIsJsenv && filenameRelativeIsInternal) {
    const internalFilenameRelative = filenameRelative.slice(`node_modules/@jsenv/core/`.length)
    return internalFilenameRelative
  }

  return filenameRelative
}
