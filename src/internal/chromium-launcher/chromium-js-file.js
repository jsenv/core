import { installBrowserErrorStackRemapping } from "internal/error-stack-remapping/installBrowserErrorStackRemapping.js"
import { fetchAndEvalUsingXHR } from "../fetchAndEvalUsingXHR.js"

window.execute = async ({
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  browserPlatformFileRelativeUrl,
  sourcemapMainFileRelativeUrl,
  sourcemapMappingFileRelativeUrl,
  compileServerOrigin,
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
  const browserPlatformCompiledFileRemoteUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}otherwise-global-bundle/${browserPlatformFileRelativeUrl}`
  await fetchAndEvalUsingXHR(browserPlatformCompiledFileRemoteUrl)
  const { __browserPlatform__ } = window

  const { compileDirectoryRemoteUrl, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })
  const compiledFileRemoteUrl = `${compileDirectoryRemoteUrl}${fileRelativeUrl}`

  await fetchAndEvalUsingXHR(`${compileServerOrigin}/${sourcemapMainFileRelativeUrl}`)
  const { SourceMapConsumer } = window.sourceMap
  SourceMapConsumer.initialize({
    "lib/mappings.wasm": `${compileServerOrigin}/${sourcemapMappingFileRelativeUrl}`,
  })
  const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
    SourceMapConsumer,
  })

  return executeFile(compiledFileRemoteUrl, {
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
