import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode, launchChromium } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const testPlan = {
  [`${testDirectoryRelativeUrl}*.spec.js`]: {
    chromium: {
      launch: launchChromium,
    },
    node: {
      launch: launchNode,
    },
  },
  [`${testDirectoryRelativeUrl}b.spec.js`]: {
    chromium: null,
    node: {
      launch: launchNode,
    },
  },
}

const actual = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  compileGroupCount: 1,
  executionDefaultOptions: {
    ...EXECUTE_TEST_PARAMS.executionDefaultOptions,
    collectRuntimeName: false,
    collectRuntimeVersion: false,
  },
})
const expected = {
  summary: {
    executionCount: 3,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 3,
    startMs: actual.summary.startMs,
    endMs: actual.summary.endMs,
  },
  report: {
    [`${testDirectoryRelativeUrl}a.spec.js`]: {
      chromium: {
        status: "completed",
        namespace: {},
      },
      node: {
        status: "completed",
        namespace: {},
      },
    },
    [`${testDirectoryRelativeUrl}b.spec.js`]: {
      node: {
        status: "completed",
        namespace: {},
      },
    },
  },
}
assert({ actual, expected })
