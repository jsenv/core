import { parentPort, workerData } from "worker_threads"
import { execute, launchNode } from "@jsenv/core"
import { urlToRelativeUrl } from "@jsenv/util"

const { fileUrl } = workerData
const projectDirectoryUrl = new URL("./", fileUrl)
const executionResult = await execute({
  projectDirectoryUrl,
  fileRelativeUrl: urlToRelativeUrl(fileUrl, projectDirectoryUrl),
  launch: launchNode,
  // measurePerformance: true,
  compileServerCanWriteOnFilesystem: false,
  collectPerformance: true,
})
parentPort.postMessage(executionResult)
