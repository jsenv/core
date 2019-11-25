import { installBrowserErrorStackRemapping } from "@jsenv/error-stack-sourcemap/src/installBrowserErrorStackRemapping/installBrowserErrorStackRemapping.js"
import { resolveImport } from "@jsenv/import-map"
import { loadScript } from "./loadScript.js"

window.execute = async ({
  compileServerOrigin,
  fileRelativePath,
  collectNamespace,
  collectCoverage,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching puppetteer
  // it avoids seeing error in platform logs during testing
  errorExposureInConsole = false,
  errorExposureInNotification = false,
  errorExposureInDocument = true,
}) => {
  await loadScript(`${compileServerOrigin}/.jsenv/browser-platform.js`)
  const { __browserPlatform__ } = window

  const { relativePathToCompiledHref, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })

  await loadScript("/node_modules/source-map/dist/source-map.js")
  const { SourceMapConsumer } = window.sourceMap
  SourceMapConsumer.initialize({
    "lib/mappings.wasm": "/node_modules/source-map/lib/mappings.wasm",
  })

  const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
    resolveHref: ({ specifier, importer = `${compileServerOrigin}${fileRelativePath}` }) => {
      return resolveImport({ specifier, importer })
    },
    SourceMapConsumer,
  })

  return executeFile(relativePathToCompiledHref(fileRelativePath), {
    collectNamespace,
    collectCoverage,
    executionId,
    errorExposureInConsole,
    errorExposureInNotification,
    errorExposureInDocument,
    errorTransform: async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error

      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    },
  })
}
