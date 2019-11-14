// import { assert } from "@jsenv/assert"
// import { launchChromium } from "@jsenv/chromium-launcher"
import { launchNode } from "@jsenv/node-launcher"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { startContinuousTesting } from "../../../index.js"
import { CONTINUOUS_TESTING_TEST_PARAM } from "../continuous-testing-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`

const executeDescription = {
  [`${folderRelativePath}/*.spec.js`]: {
    node: {
      launch: launchNode,
    },
    // chromium: {
    //   launch: launchChromium,
    // },
  },
}

await startContinuousTesting({
  ...CONTINUOUS_TESTING_TEST_PARAM,
  compileIntoRelativePath,
  defaultAllocatedMsPerExecution: Infinity,
  executeDescription,
})
