import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

import { executeTestPlan, launchNode, launchChromium, convertCommonJsWithRollup } from "@jsenv/core"
import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const transformReactJSX = require("@babel/plugin-transform-react-jsx")

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const { testPlanCoverage } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  babelPluginMap: {
    "transform-react-jsx": [transformReactJSX, { pragma: "React.createElement" }],
  },
  convertMap: {
    "./node_modules/react/index.js": convertCommonJsWithRollup,
  },
  testPlan: {
    [htmlFileRelativeUrl]: {
      chromium: {
        launch: launchChromium,
      },
    },
    [fileRelativeUrl]: {
      node: {
        launch: launchNode,
      },
    },
  },
  coverageForceIstanbul: true,
  coverage: true,
  coverageConfig: {
    [`${testDirectoryRelativeUrl}file.jsx`]: true,
  },
})
const actual = testPlanCoverage
const expected = {
  [`./${testDirectoryRelativeUrl}file.jsx`]: {
    ...actual[`./${testDirectoryRelativeUrl}file.jsx`],
    s: { 0: 2, 1: 2 },
  },
}
assert({ actual, expected })
