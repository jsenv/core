import { assert } from "@jsenv/assert"
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
    [`${folderRelativePath}/timeout.js`]: {
      node: {
        launch: (options) =>
          launchNode({
            ...options,
            env: { AWAIT_FOREVER: true },
          }),
        allocatedMs: 10000,
      },
    },
  },
  coverageConfig: {
    [`${folderRelativePath}/timeout.js`]: true,
  },
})
const expected = {
  [`${folderRelativePath.slice(1)}/timeout.js`]: {
    ...actual[`${folderRelativePath.slice(1)}/timeout.js`],
    s: { 0: 0, 1: 0 },
  },
}
assert({ actual, expected })
