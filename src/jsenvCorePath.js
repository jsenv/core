import { resolve } from "path"
import { hrefToPathname } from "@jsenv/module-resolution"
import {
  pathnameToOperatingSystemPath,
  operatingSystemPathToPathname,
  pathnameToRelativePathname,
} from "@jsenv/operating-system-path"

let jsenvCorePath
if (typeof __filename === "string") {
  jsenvCorePath = resolve(__filename, "../../../") // get ride of dist/node/main.js
} else {
  const selfPathname = hrefToPathname(import.meta.url)
  const selfPath = pathnameToOperatingSystemPath(selfPathname)
  jsenvCorePath = resolve(selfPath, "../../") // get ride of src/JSENV_PATH.js
}

export { jsenvCorePath }

export const jsenvCorePathname = operatingSystemPathToPathname(jsenvCorePathname)

/**
 * jsenvRelativePathInception is used for the following:
 *
 * You may want to override some file internally used by jsenv.
 * When you do that you must pass a relativePath to a file in your project.
 * If you don't pass a custom file, jsenv must provide a default file.
 *
 * Keep in mind: it is possible for a project to depend indirectly from jsenv
 * so that the jsenv module will not be in project/node_modules/@jsenv/module-name
 * but in project/node_modules/@jsenv/whatever/node_modules/@jsenv/module-name.
 * It means the file is still relative to project but node module resolution
 * would not find the file.
 *
 */

export const jsenvCoreRelativePathInception = ({ jsenvCoreRelativePath, projectPathname }) => {
  const jsenvPathname = `${jsenvCorePathname}${jsenvCoreRelativePath}`
  const relativePath = pathnameToRelativePathname(jsenvPathname, projectPathname)
  return relativePath
}
