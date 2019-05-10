import { ROOT_FOLDER } from "./ROOT_FOLDER.js"

const JSENV_RELATIVE_PATH_FOR_OTHER_PROJECT = "node_modules/@jsenv/core"

export const filenameRelativeInception = ({ projectFolder, filenameRelative }) => {
  const projectFolderIsJsenvRoot = projectFolder === ROOT_FOLDER
  const projectFolderIsInsideJsenv = projectFolder.startsWith(`${ROOT_FOLDER}/`)

  if (!projectFolderIsJsenvRoot && !projectFolderIsInsideJsenv)
    return `${JSENV_RELATIVE_PATH_FOR_OTHER_PROJECT}/${filenameRelative}`

  if (projectFolderIsInsideJsenv) {
    throw new Error(`filenameRelativeInception work only when projectFolder is jsenv root.
projectFolder: ${projectFolder}
jsenv root: ${ROOT_FOLDER}
filenameRelative: ${filenameRelative}`)
  }

  return filenameRelative
}

// export const filenameInception = ({ projectFolder, filenameRelative }) => {
//   const filenameRelativeIsInternal = filenameRelative.startsWith(`node_modules/@jsenv/core/`)
//   if (!filenameRelativeIsInternal) return `${projectFolder}/${filenameRelative}`

//   if (projectFolder === ROOT_FOLDER || projectFolder.startsWith(`${ROOT_FOLDER}/`)) {
//     const internalFilenameRelative = filenameRelative.slice(`node_modules/@jsenv/core/`.length)

//     return `${projectFolder}/${internalFilenameRelative}`
//   }

//   return `${projectFolder}/${filenameRelative}`
// }
