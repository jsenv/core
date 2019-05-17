import { pathnameToOperatingSystemFilename, pathnameIsInside } from "./operating-system-filename.js"
import { JSENV_PATHNAME } from "./JSENV_PATH.js"

const JSENV_RELATIVE_PATH = "/node_modules/@jsenv/core"

export const relativePathInception = ({ projectPathname, relativePath }) => {
  const projectIsJsenv = projectPathname === JSENV_PATHNAME
  const projectIsInsideJsenv = pathnameIsInside(projectPathname, JSENV_PATHNAME)

  if (!projectIsJsenv && !projectIsInsideJsenv) return `${JSENV_RELATIVE_PATH}${relativePath}`

  if (projectIsInsideJsenv) {
    throw new Error(`relativePathInception work only inside jsenv.
project path: ${pathnameToOperatingSystemFilename(projectPathname)}
jsenv path: ${pathnameToOperatingSystemFilename(JSENV_PATHNAME)}
relative path: ${relativePath}`)
  }

  return relativePath
}
