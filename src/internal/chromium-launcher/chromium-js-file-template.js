// TODO: use serveBundle to get this file

import { installBrowserErrorStackRemapping } from "@jsenv/error-stack-sourcemap/src/installBrowserErrorStackRemapping/installBrowserErrorStackRemapping.js"
import { resolveImport } from "@jsenv/import-map"
import { fetchAndEvalUsingXHR } from "../fetchAndEvalUsingXHR.js"

window.execute = async ({
  outDirectoryRelativeUrl,
  fileRelativeUrl,
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
  // better to use import.meta.resolve here
  // just in case a project itself uses source-map and it gets deduped
  // to be tested
  const sourcemapPackageMainFileRemoteUrl = `${compileServerOrigin}/node_modules/source-map/dist/source-map.js`
  await fetchAndEvalUsingXHR(sourcemapPackageMainFileRemoteUrl)
  const { SourceMapConsumer } = window.sourceMap
  const sourcemapPackageMappingFileRemoteUrl = `${compileServerOrigin}/node_modules/source-map/lib/mappings.wasm`
  SourceMapConsumer.initialize({
    "lib/mappings.wasm": sourcemapPackageMappingFileRemoteUrl,
  })

  const browserPlatformCompiledFileRemoteUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}otherwise-global-bundle/src/browserPlatform.js`
  await fetchAndEvalUsingXHR(browserPlatformCompiledFileRemoteUrl)
  const { __browserPlatform__ } = window

  const { compileDirectoryRemoteUrl, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })
  const compiledFileRemoteUrl = `${compileDirectoryRemoteUrl}${fileRelativeUrl}`

  const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
    resolveHref: ({ specifier, importer = compiledFileRemoteUrl }) => {
      return resolveImport({ specifier, importer })
    },
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
