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

executeTestPlan({
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  logLevel: "info",
  jsenvDirectoryRelativeUrl,
  testPlan,
  completedExecutionLogAbbreviation: false,
  completedExecutionLogMerging: true,
  executionDefaultOptions: { allocatedMs: 5000 },
})
