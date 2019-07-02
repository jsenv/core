import { assert } from "@dmail/assert"
import { launchChromium } from "@jsenv/chromium-launcher"
import { launchNode } from "@jsenv/node-launcher"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { cover } from "../../../index.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`

const { coverageMap } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  coverDescription: {
    [`${folderJsenvRelativePath}/file.js`]: true,
  },
  executeDescription: {
    [`${folderJsenvRelativePath}/use-file.js`]: {
      node: {
        launch: launchNode,
      },
      chromium: {
        launch: launchChromium,
      },
    },
  },
})
assert({
  actual: coverageMap,
  expected: {
    [`${folderJsenvRelativePath.slice(1)}/file.js`]: {
      ...coverageMap[`${folderJsenvRelativePath.slice(1)}/file.js`],
      s: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 0 },
    },
  },
})
