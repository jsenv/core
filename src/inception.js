import { readFileSync } from "fs"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { JSENV_PATH, JSENV_PATHNAME } from "./JSENV_PATH.js"

const JSENV_RELATIVE_PATH = "/node_modules/@jsenv/core"

export const relativePathInception = ({ projectPathname, relativePath }) => {
  const projectIsJsenv = projectPathname === JSENV_PATH || pathnameIsJsenvCore(projectPathname)

  if (!projectIsJsenv) {
    const projectIsInsideJsenv = projectPathname.startsWith(`${JSENV_PATH}/`)
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

const pathMap = {}
const pathnameIsJsenvCore = (pathname) => {
  if (pathname in pathMap) return pathMap[pathname]

  const value = (() => {
    const packagePath = pathnameToOperatingSystemPath(`${pathname}/package.json`)
    try {
      const buffer = readFileSync(packagePath)
      const content = String(buffer)
      const packageData = JSON.parse(content)
      return packageData.name === "@jsenv/core"
    } catch (e) {
      if (e.code === "ENOENT") return false
      if (e.name === "SyntaxError") return false
      throw e
    }
  })()

  pathMap[pathname] = value
  return value
}
