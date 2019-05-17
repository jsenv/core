// eslint-disable-next-line import/no-unresolved
import { filePath } from "/.jsenv/browser-self-execute-static-data.js"
import { loadUsingScript } from "../loadUsingScript.js"
import { fetchUsingXHR } from "../browser-platform-service/browser-platform/fetchUsingXHR.js"

// eslint-disable-next-line import/newline-after-import
;(async () => {
  const { body } = await fetchUsingXHR("/.jsenv/browser-self-execute-dynamic-data.json")
  const { compileServerOrigin } = JSON.parse(body)

  await loadUsingScript(`${compileServerOrigin}/.jsenv/browser-platform.js`)
  const { __browserPlatform__ } = window

  const { pathToCompiledHref, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })
  const compiledFile = pathToCompiledHref(filePath)
  executeFile(compiledFile)
})()
