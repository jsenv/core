import { urlToRelativeUrl } from "@jsenv/util"
import { execute, launchNode } from "@jsenv/core"

export const executeFile = async (fileUrl) => {
  const projectDirectoryUrl = new URL("./", fileUrl)
  const executionResult = await execute({
    projectDirectoryUrl,
    fileRelativeUrl: urlToRelativeUrl(fileUrl, projectDirectoryUrl),
    launch: launchNode,
    // measurePerformance: true,
    compileServerCanWriteOnFilesystem: false,
    collectPerformance: true,
  })
  return executionResult
}
