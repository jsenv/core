import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import {
  executeTestPlan,
  launchNode,
  launchChromium,
  convertCommonJsWithRollup,
} from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const transformReactJSX = import.meta.require("@babel/plugin-transform-react-jsx")

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
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
    [`${testDirectoryRelativePath}import-jsx.js`]: {
      node: {
        launch: launchNode,
      },
      chromium: {
        launch: launchChromium,
      },
    },
  },
  coverage: true,
  coverageConfig: {
    [`${testDirectoryRelativePath}file.jsx`]: true,
  },
})
const expected = {
  [`${testDirectoryRelativePath}file.jsx`]: {
    ...actual[`${testDirectoryRelativePath}file.jsx`],
    s: { 0: 2, 1: 2 },
  },
}
assert({ actual, expected })
