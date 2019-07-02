import { assert } from "@dmail/assert"
import { launchChromium } from "@jsenv/chromium-launcher"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { cover } from "../../../index.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`

const { coverageMap } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  executeDescription: {
    [`${folderJsenvRelativePath}/file.js`]: {
      chromium: {
        launch: launchChromium,
      },
    },
  },
  generateMissedCoverage: false,
})
assert({
  actual: Object.keys(coverageMap).includes(
    "src/browser-platform-service/browser-platform/index.js",
  ),
  expected: true,
})
