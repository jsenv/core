import {
  globalName,
  entryFilenameRelative,
  groupDescription,
  // eslint-disable-next-line import/no-unresolved
} from "bundle-browser-options.js"
import { detect } from "../../platform/browser/browserDetect/index.js"
import { browserToCompileId } from "../../platform/browser/browserToCompileId.js"
import { loadUsingScript } from "./loadUsingScript.js"

const compileId = browserToCompileId(detect(), groupDescription)
const scriptSrc = `./${compileId}/${entryFilenameRelative}`

export default loadUsingScript(scriptSrc).then(() => {
  return window[globalName]
})
