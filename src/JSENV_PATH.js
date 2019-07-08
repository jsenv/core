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
  // we are explicitely not asking for a file inside this project
  // it means we want one of our project file without node module resolution
  if (!relativePath.startsWith("/node_modules/")) {
    return relativePath
  }

  // we want a file owned by a node module
  // we need to know where is the node module folder
  // to know the actual relative path to the file
  const relativePathWithoutNodeModule = relativePath.slice("/node_modules/".length)
  const resolvedPath = resolvePath({
    specifier: relativePathWithoutNodeModule,
    importer: `http://example.com${projectPathname}`,
    importMap,
  })
  return hrefToPathname(resolvedPath)
}
