// eslint-disable-next-line import/no-unresolved
import { globalName, entryFilenameRelative, groupDescription } from "bundle-browser-options.js"
import { detect } from "../../platform/browser/browserDetect/index.js"
import { browserToCompileId } from "../../platform/browser/browserToCompileId.js"
import { globalNameToPromiseGlobalName } from "./globalNameToPromiseGlobalName.js"
import { loadUsingScript } from "./loadUsingScript.js"

const compileId = browserToCompileId(detect(), groupDescription)
const scriptSrc = `./${compileId}/${entryFilenameRelative}`

window[globalNameToPromiseGlobalName(globalName)] = loadUsingScript(scriptSrc).then(() => {
  return window[globalName]
})
