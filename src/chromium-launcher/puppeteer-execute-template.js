// eslint-disable-next-line import/no-unresolved
import {
  compileServerOrigin,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  // eslint-disable-next-line import/no-unresolved
} from "/.jsenv/puppeteer-execute-data.js"
import { loadUsingScript } from "../loadUsingScript.js"

window.execute = async () => {
  await loadUsingScript(`${compileServerOrigin}/.jsenv/browser-platform.js`)
  const { __browserPlatform__ } = window

  const { filenameRelativeToCompiledHref, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })
  return executeFile(filenameRelativeToCompiledHref(filenameRelative), {
    collectNamespace,
    collectCoverage,
  })
}
