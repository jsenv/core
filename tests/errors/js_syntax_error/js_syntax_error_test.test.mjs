import { assert } from "@jsenv/assert"

import { executeTestPlan, chromium, nodeProcess } from "@jsenv/core"

const { testPlanCoverage } = await executeTestPlan({
  logLevel: "off",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  testPlan: {
    "./main.html": {
      chromium: {
        runtime: chromium,
      },
    },
    "./main.js": {
      node: {
        runtime: nodeProcess,
      },
    },
  },
  coverage: true,
  coverageConfig: {
    "./js_syntax_error.js": true,
  },
  coverageReportTextLog: false,
  coverageReportHtmlDirectory: false,
})
const actual = testPlanCoverage
const expected = {
  "./js_syntax_error.js": {
    ...actual["./js_syntax_error.js"],
    s: {},
  },
}
assert({ actual, expected })
