import { assert } from "@dmail/assert"
import { launchChromium } from "@jsenv/chromium-launcher"
import { launchNode } from "@jsenv/node-launcher"
import { cover } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`

const { coverageMap } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  executeDescription: {
    [`${folderRelativePath}/use-file.js`]: {
      node: {
        launch: launchNode,
      },
      chromium: {
        launch: launchChromium,
      },
    },
  },
  coverDescription: {
    [`${folderRelativePath}/file.js`]: true,
  },
})
assert({
  actual: coverageMap,
  expected: {
    [`${folderRelativePath.slice(1)}/file.js`]: {
      ...coverageMap[`${folderRelativePath.slice(1)}/file.js`],
      s: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 0 },
    },
  },
})
