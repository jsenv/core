import { resolve } from "path"
import { hrefToPathname } from "@jsenv/module-resolution"
import {
  pathnameToOperatingSystemPath,
  operatingSystemPathToPathname,
} from "./operating-system-path.js"

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
