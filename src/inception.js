import { pathnameToOperatingSystemPath, pathnameIsInside } from "@jsenv/operating-system-path"
import { JSENV_PATHNAME } from "./JSENV_PATH.js"

const JSENV_RELATIVE_PATH = "/node_modules/@jsenv/core"

export const relativePathInception = ({ projectPathname, relativePath }) => {
  const projectIsJsenv = projectPathname === JSENV_PATHNAME
  const projectIsInsideJsenv = pathnameIsInside(projectPathname, JSENV_PATHNAME)

  if (!projectIsJsenv && !projectIsInsideJsenv) return `${JSENV_RELATIVE_PATH}${relativePath}`

  if (projectIsInsideJsenv) {
    throw new Error(`relativePathInception work only inside jsenv.
project path: ${pathnameToOperatingSystemPath(projectPathname)}
jsenv path: ${pathnameToOperatingSystemPath(JSENV_PATHNAME)}
relative path: ${relativePath}`)
  }

  return relativePath
}
