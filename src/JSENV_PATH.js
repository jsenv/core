import { resolve } from "path"
import { resolvePath, hrefToPathname } from "@jsenv/module-resolution"
import {
  pathnameToOperatingSystemPath,
  operatingSystemPathToPathname,
} from "@jsenv/operating-system-path"

let jsenvPath
if (typeof __filename === "string") {
  jsenvPath = resolve(__filename, "../../../") // get ride of dist/node/main.js
} else {
  const selfPathname = hrefToPathname(import.meta.url)
  const selfPath = pathnameToOperatingSystemPath(selfPathname)
  jsenvPath = resolve(selfPath, "../../") // get ride of src/JSENV_PATH.js
}

export const JSENV_PATH = jsenvPath

export const JSENV_PATHNAME = operatingSystemPathToPathname(jsenvPath)

export const relativePathInception = ({ projectPathname, importMap, relativePath }) => {
  if (projectPathname === JSENV_PATHNAME) return relativePath

  const resolvedPath = resolvePath({
    specifier: `@jsenv/core${relativePath}`,
    importer: projectPathname,
    importMap,
  })
  return hrefToPathname(resolvedPath)
}
