import { ROOT_FOLDER } from "./ROOT_FOLDER.js"

export const resolveProjectFilename = ({ projectFolder, filenameRelative }) => {
  const projectIsJsenv =
    projectFolder === ROOT_FOLDER || projectFolder.startsWith(`${ROOT_FOLDER}/`)
  const filenameRelativeIsInternal = filenameRelative.startsWith(`node_modules/@jsenv/core/`)

  if (projectIsJsenv && filenameRelativeIsInternal) {
    const internalFilenameRelative = filenameRelative.slice(`node_modules/@jsenv/core/`.length)
    return `${ROOT_FOLDER}/${internalFilenameRelative}`
  }

  return `${projectFolder}/${filenameRelative}`
}
