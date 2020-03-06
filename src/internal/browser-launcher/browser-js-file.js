import { installBrowserErrorStackRemapping } from "../error-stack-remapping/installBrowserErrorStackRemapping.js"
import { fetchAndEvalUsingXHR } from "../fetchAndEvalUsingXHR.js"

window.execute = async ({
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  browserRuntimeFileRelativeUrl,
  sourcemapMainFileRelativeUrl,
  sourcemapMappingFileRelativeUrl,
  compileServerOrigin,
  collectNamespace,
  collectCoverage,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching the browser
  // it avoids seeing error in runtime logs during testing
  errorExposureInConsole = false,
  errorExposureInNotification = false,
  errorExposureInDocument = true,
}) => {
  const browserRuntimeCompiledFileRemoteUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}otherwise-global-bundle/${browserRuntimeFileRelativeUrl}`
  await fetchAndEvalUsingXHR(browserRuntimeCompiledFileRemoteUrl)
  const { __browserRuntime__ } = window

  const { compileDirectoryRemoteUrl, executeFile } = __browserRuntime__.create({
    compileServerOrigin,
  })
  const compiledFileRemoteUrl = `${compileDirectoryRemoteUrl}${fileRelativeUrl}`

  let errorTransform = (error) => error
  if (Error.captureStackTrace) {
    await fetchAndEvalUsingXHR(`${compileServerOrigin}/${sourcemapMainFileRelativeUrl}`)
    const { SourceMapConsumer } = window.sourceMap
    SourceMapConsumer.initialize({
      "lib/mappings.wasm": `${compileServerOrigin}/${sourcemapMappingFileRelativeUrl}`,
    })
    const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
      SourceMapConsumer,
    })

    errorTransform = async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error

      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    }
  }

  return executeFile(compiledFileRemoteUrl, {
    collectNamespace,
    collectCoverage,
    executionId,
    errorExposureInConsole,
    errorExposureInNotification,
    errorExposureInDocument,
    errorTransform,
  })
}
