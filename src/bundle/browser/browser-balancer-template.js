/* eslint-disable */
// eslint must be disabled because he doesn't like that we try to load
// something containing \0
import {
  globalName,
  globalNameIsPromise,
  entryFilenameRelative,
  groupMap,
} from "\0bundle-browser-options.js"
/* eslint-enable */
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
