import { resolve } from "path"
import { hrefToPathname } from "@jsenv/href"
import {
  pathnameToOperatingSystemPath,
  operatingSystemPathToPathname,
  pathnameToRelativePathname,
} from "@jsenv/operating-system-path"

let exploringServerProjectPath
if (typeof __filename === "string") {
  exploringServerProjectPath = resolve(__filename, "../../../") // get ride of dist/node/main.js
} else {
  const selfPathname = hrefToPathname(import.meta.url)
  const selfPath = pathnameToOperatingSystemPath(selfPathname)
  exploringServerProjectPath = resolve(selfPath, "../../") // get ride of src/JSENV_PATH.js
}

export { exploringServerProjectPath }

export const exploringServerProjectPathname = operatingSystemPathToPathname(
  exploringServerProjectPath,
)

export const exploringServerRelativePathInception = ({
  exploringServerRelativePath,
  projectPathname,
}) => {
  const jsenvPathname = `${exploringServerProjectPathname}${exploringServerRelativePath}`
  const relativePath = pathnameToRelativePathname(jsenvPathname, projectPathname)
  return relativePath
}
