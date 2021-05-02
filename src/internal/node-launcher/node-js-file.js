import { nodeRuntime } from "../../nodeRuntime.js"

export const execute = async ({
  projectDirectoryUrl,
  fileRelativeUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching node process
  // it avoids seeing error in runtime logs during testing
  errorExposureInConsole = false,
  collectCoverage,
}) => {
  const { executeFile } = await nodeRuntime.create({
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
  })

  return executeFile(fileRelativeUrl, {
    executionId,
    errorExposureInConsole,
    collectCoverage,
  })
}
