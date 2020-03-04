import { resolveUrl } from "@jsenv/util"
import { installNodeErrorStackRemapping } from "../error-stack-remapping/installNodeErrorStackRemapping.js"
import { nodeRuntime } from "../../nodeRuntime.js"

export const execute = async ({
  projectDirectoryUrl,
  fileRelativeUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  collectNamespace,
  collectCoverage,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching node process
  // it avoids seeing error in runtime logs during testing
  errorExposureInConsole = false,
}) => {
  // should we ignore cancellation error ?
  // process.once("unhandledRejection", (valueRejected) => {
  //   throw valueRejected
  // })

  const { compileDirectoryRemoteUrl, executeFile } = await nodeRuntime.create({
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
  })

  const { getErrorOriginalStackString } = installNodeErrorStackRemapping({
    projectDirectoryUrl,
  })

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
