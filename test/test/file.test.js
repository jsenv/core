import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../src/ROOT_FOLDER.js"
import { launchNode, launchChromium, test } from "../../index.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`

const testDescription = {
  [`/${testFolderRelative}/file.js`]: {
    node: {
      launch: launchNode,
    },
    chromium: {
      launch: launchChromium,
    },
  },
}

const actual = await test({
  projectFolder,
  compileInto,
  executeDescription: testDescription,
  executionLogLevel: "off",
  collectNamespace: true,
  measureDuration: false,
  captureConsole: false,
})
const expected = {
  planResult: {
    [`${testFolderRelative}/file.js`]: {
      node: {
        status: "completed",
        namespace: {
          default: "node",
        },
        platformName: "node",
        platformVersion: "8.9.0",
      },
      chromium: {
        status: "completed",
        namespace: {
          default: "browser",
        },
        platformName: "chromium",
        platformVersion: "73.0.3679.0",
      },
    },
  },
  planResultSummary: {
    executionCount: 2,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 2,
  },
}
assert({ actual, expected })
