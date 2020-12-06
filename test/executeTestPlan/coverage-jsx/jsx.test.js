import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { require } from "../../../src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode, launchChromium, convertCommonJsWithRollup } from "@jsenv/core"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const transformReactJSX = require("@babel/plugin-transform-react-jsx")

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}import-jsx.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}import-jsx.js`
const { coverageMap: actual } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
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
  coverage: true,
  coverageConfig: {
    [`${testDirectoryRelativeUrl}file.jsx`]: true,
  },
})
const expected = {
  [`${testDirectoryRelativeUrl}file.jsx`]: {
    ...actual[`${testDirectoryRelativeUrl}file.jsx`],
    s: { 0: 2, 1: 2 },
  },
}
assert({ actual, expected })
