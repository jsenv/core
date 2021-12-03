import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const testPlan = {
  [`${testDirectoryRelativeUrl}*.spec.js`]: {
    node: {
      runtime: nodeRuntime,
      captureConsole: true,
    },
  },
}

await executeTestPlan({
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  logLevel: "info",
  jsenvDirectoryRelativeUrl,
  testPlan,
  completedExecutionLogAbbreviation: true,
  completedExecutionLogMerging: true,
  defaultMsAllocatedPerExecution: 3000,
})
