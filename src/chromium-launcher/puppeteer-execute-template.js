import { loadUsingScript } from "../loadUsingScript.js"

window.execute = async ({
  compileServerOrigin,
  filenameRelative,
  collectNamespace,
  collectCoverage,
}) => {
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
