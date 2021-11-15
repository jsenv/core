import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  executeTestPlan,
  nodeRuntime,
  chromiumRuntime,
  commonJsToJavaScriptModule,
} from "@jsenv/core"
import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const transformReactJSX = require("@babel/plugin-transform-react-jsx")

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}jsx.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}jsx.js`
const { testPlanCoverage } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  babelPluginMap: {
    "transform-react-jsx": [
      transformReactJSX,
      { pragma: "React.createElement" },
    ],
  },
  customCompilers: {
    "./node_modules/react/index.js": commonJsToJavaScriptModule,
  },
  testPlan: {
    [htmlFileRelativeUrl]: {
      chromium: {
        runtime: chromiumRuntime,
      },
    },
    [fileRelativeUrl]: {
      node: {
        runtime: nodeRuntime,
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
    s: {
      0: 2,
      1: 2,
      2: 2,
    },
  },
}
assert({ actual, expected })
