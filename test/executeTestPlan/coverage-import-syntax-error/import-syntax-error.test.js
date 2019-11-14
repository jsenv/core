import { assert } from "@jsenv/assert"
import { launchChromium } from "@jsenv/chromium-launcher"
import { launchNode } from "@jsenv/node-launcher"
import { cover } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const { coverageMap: actual } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  executeDescription: {
    [`${folderRelativePath}/import-syntax-error.js`]: {
      chromium: {
        launch: launchChromium,
      },
      node: {
        launch: launchNode,
      },
    },
  },
  coverDescription: {
    [`${folderRelativePath}/syntax-error.js`]: true,
  },
})
const expected = {
  [`${folderRelativePath.slice(1)}/syntax-error.js`]: {
    ...actual[`${folderRelativePath.slice(1)}/syntax-error.js`],
    s: {},
  },
}
assert({
  actual,
  expected,
})
