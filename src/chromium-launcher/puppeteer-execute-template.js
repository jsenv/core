import { loadUsingScript } from "../loadUsingScript.js"

window.execute = async ({
  compileServerOrigin,
  fileRelativePath,
  collectNamespace,
  collectCoverage,
}) => {
  await loadUsingScript(`${compileServerOrigin}/.jsenv/browser-platform.js`)
  const { __browserPlatform__ } = window

  const { relativePathToCompiledHref, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })
  return executeFile(relativePathToCompiledHref(fileRelativePath), {
    collectNamespace,
    collectCoverage,
  })
}
