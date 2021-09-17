import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, launchNode } from "@jsenv/core"
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
      launch: launchNode,
      measureDuration: true,
      captureConsole: true,
    },
  },
}

executeTestPlan({
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  logLevel: "info",
  jsenvDirectoryRelativeUrl,
  testPlan,
  compileGroupCount: 1,
  completedExecutionLogAbbreviation: false,
  completedExecutionLogMerging: true,
  executionDefaultOptions: { allocatedMs: 5000 },
})
