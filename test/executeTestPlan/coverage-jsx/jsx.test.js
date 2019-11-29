import { assert } from "@jsenv/assert"
import { launchChromium } from "@jsenv/chromium-launcher"
import { launchNode } from "@jsenv/node-launcher"
import { cover } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const { convertCommonJsWithRollup } = import.meta.require("@jsenv/commonjs-converter")
const transformReactJSX = import.meta.require("@babel/plugin-transform-react-jsx")

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`

const { coverageMap } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  babelPluginMap: {
    "transform-react-jsx": [transformReactJSX, { pragma: "React.createElement" }],
  },
  convertMap: {
    "/node_modules/react/index.js": convertCommonJsWithRollup,
  },
  executeDescription: {
    [`${folderRelativePath}/import-jsx.js`]: {
      node: {
        launch: launchNode,
      },
      chromium: {
        launch: launchChromium,
      },
    },
  },
  coverageConfig: {
    [`${folderRelativePath}/file.jsx`]: true,
  },
})
const actual = coverageMap
const expected = {
  [`${folderRelativePath.slice(1)}/file.jsx`]: {
    ...coverageMap[`${folderRelativePath.slice(1)}/file.jsx`],
    s: { 0: 2, 1: 2 },
  },
}
assert({
  actual,
  expected,
})
