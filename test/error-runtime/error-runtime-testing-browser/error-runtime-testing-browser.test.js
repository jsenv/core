import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"
import { executeTestPlan, launchChromium } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}file.spec.html`
const testPlan = {
  [htmlFileRelativeUrl]: {
    chromium: {
      launch: (params) =>
        launchChromium({
          ...params,
          // headless: false
        }),
      captureConsole: true,
    },
  },
}
const actual = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  executionLogLevel: "off",
  // stopAfterExecute: false,
})
const expected = {
  summary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 0,
    startMs: actual.summary.startMs,
    endMs: actual.summary.endMs,
  },
  report: {
    [htmlFileRelativeUrl]: {
      chromium: {
        status: "errored",
        error: Object.assign(new Error(`ask() should return 42, got 40`), {
          filename: actual.report[htmlFileRelativeUrl].chromium.error.filename,
          lineno: actual.report[htmlFileRelativeUrl].chromium.error.lineno,
          columnno: actual.report[htmlFileRelativeUrl].chromium.error.columnno,
        }),
        namespace: actual.report[htmlFileRelativeUrl].chromium.namespace,
        consoleCalls: actual.report[htmlFileRelativeUrl].chromium.consoleCalls,
        runtimeName: "chromium",
        runtimeVersion: assert.any(String),
      },
    },
  },
}
assert({ actual, expected })
