import {
  globalName,
  globalNameIsPromise,
  entryFilenameRelative,
  groupMap,
  // eslint-disable-next-line import/no-unresolved
} from "\0bundle-browser-options.js"
import { detect } from "../../platform/browser/browserDetect/index.js"
import { browserToCompileId } from "../../platform/browser/browserToCompileId.js"
import { loadUsingScript } from "./loadUsingScript.js"
import { loadUsingDocumentWrite } from "./loadUsingDocumentWrite.js"

const compileId = browserToCompileId(detect(), groupMap)
const scriptSrc = `./${compileId}/${entryFilenameRelative}`

if (globalNameIsPromise) {
  window[globalName] = loadUsingScript(scriptSrc).then(() => window[globalName])
} else {
  loadUsingDocumentWrite(scriptSrc)
}
