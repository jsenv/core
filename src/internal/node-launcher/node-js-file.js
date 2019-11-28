import { COMPILE_ID_COMMONJS_BUNDLE } from "internal/CONSTANTS.js"
import { fileUrlToPath, resolveUrl } from "internal/urlUtils.js"
import { installNodeErrorStackRemapping } from "internal/error-stack-remapping/installNodeErrorStackRemapping.js"
import { fetchUsingHttp } from "internal/platform/createNodePlatform/fetchUsingHttp.js"

export const execute = async ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,

  collectNamespace,
  collectCoverage,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching node process
  // it avoids seeing error in platform logs during testing
  errorExposureInConsole = false,
}) => {
  process.once("unhandledRejection", (valueRejected) => {
    throw valueRejected
  })

  const outDirectoryRemoteUrl = resolveUrl(outDirectoryRelativeUrl, compileServerOrigin)
  const nodePlatformCompiledFileServerUrl = resolveUrl(
    `${COMPILE_ID_COMMONJS_BUNDLE}/src/nodePlatform.js`,
    outDirectoryRemoteUrl,
  )
  await fetchUsingHttp(nodePlatformCompiledFileServerUrl)

  const outDirectoryUrl = resolveUrl(outDirectoryRelativeUrl, projectDirectoryUrl)
  const nodePlatformCompiledFileUrl = resolveUrl(
    `${COMPILE_ID_COMMONJS_BUNDLE}/src/nodePlatform.js`,
    outDirectoryUrl,
  )
  const nodePlatformCompiledFilePath = fileUrlToPath(nodePlatformCompiledFileUrl)
  // eslint-disable-next-line import/no-dynamic-require
  const { nodePlatform } = require(nodePlatformCompiledFilePath)

  const { compileDirectoryRemoteUrl, executeFile } = nodePlatform.create({
    projectDirectoryUrl,
    compileServerOrigin,
  })

  const { getErrorOriginalStackString } = installNodeErrorStackRemapping()

  const compiledFileRemoteUrl = resolveUrl(fileRelativeUrl, compileDirectoryRemoteUrl)
  return executeFile(compiledFileRemoteUrl, {
    collectNamespace,
    collectCoverage,
    executionId,
    errorTransform: async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error

      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    },
    errorExposureInConsole,
  })
}
