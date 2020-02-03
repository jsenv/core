import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchChromium } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const testPlan = {
  [`${testDirectoryRelativeUrl}*.spec.js`]: {
    browser: {
      launch: launchChromium,
      measureDuration: true,
    },
  },
}

const actual = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  logLevel: "info",
  jsenvDirectoryClean: false,
  jsenvDirectoryRelativeUrl,
  testPlan,
  compileGroupCount: 1,
  completedExecutionLogMerging: true,
  completedExecutionLogAbbreviation: false,
})
const expected = {
  summary: {
    executionCount: 4,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 3,
    startMs: actual.summary.startMs,
    endMs: actual.summary.endMs,
  },
  report: actual.report,
}
assert({ actual, expected })
