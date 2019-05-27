import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { JSENV_PATHNAME } from "./JSENV_PATH.js"

const JSENV_RELATIVE_PATH = "/node_modules/@jsenv/core"

export const relativePathInception = ({ projectPathname, relativePath }) => {
  const projectIsJsenv = projectPathname.endsWith("/@jsenv/core")

  if (!projectIsJsenv) {
    const projectIsInsideJsenv = projectPathname.includes("/@jsenv/core/")
    if (projectIsInsideJsenv) {
      throw new Error(`relativePathInception work only inside jsenv.
project path: ${pathnameToOperatingSystemPath(projectPathname)}
jsenv path: ${pathnameToOperatingSystemPath(JSENV_PATHNAME)}
relative path: ${relativePath}`)
    }

    return `${JSENV_RELATIVE_PATH}${relativePath}`
  }

  return relativePath
}
