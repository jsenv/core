import { execute, launchNode } from "@jsenv/core"
import { urlToRelativeUrl } from "@jsenv/util"

export const performanceFromFile = async (fileUrl) => {
  const projectDirectoryUrl = new URL("./", fileUrl)
  const executionResult = await execute({
    projectDirectoryUrl,
    fileRelativeUrl: urlToRelativeUrl(fileUrl, projectDirectoryUrl),
    launch: launchNode,
    // measurePerformance: true,
    compileServerCanWriteOnFilesystem: false,
    collectPerformance: true,
  })
  return executionResult.performance
}
