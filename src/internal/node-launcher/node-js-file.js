import { resolveUrl } from "@jsenv/util"
import { installNodeErrorStackRemapping } from "../error-stack-remapping/installNodeErrorStackRemapping.js"
import { nodeRuntime } from "../../nodeRuntime.js"

export const execute = async ({
  projectDirectoryUrl,
  fileRelativeUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  importMapFileRelativeUrl,
  importDefaultExtension,

  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching node process
  // it avoids seeing error in runtime logs during testing
  errorExposureInConsole = false,
}) => {
  const { compileDirectoryRelativeUrl, executeFile } = await nodeRuntime.create({
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    importMapFileRelativeUrl,
    importDefaultExtension,
  })

  const { getErrorOriginalStackString } = installNodeErrorStackRemapping({
    projectDirectoryUrl,
  })

  const compiledFileRemoteUrl = resolveUrl(
    fileRelativeUrl,
    `${compileServerOrigin}/${compileDirectoryRelativeUrl}`,
  )
  return executeFile(compiledFileRemoteUrl, {
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
