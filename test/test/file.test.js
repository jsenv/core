import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { launchNode, launchChromium, test } from "../../index.js"

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/file.js`

const testDescription = {
  [fileRelativePath]: {
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
  compileIntoRelativePath,
  executeDescription: testDescription,
  executionLogLevel: "off",
  collectNamespace: true,
  measureDuration: false,
  captureConsole: false,
})
const expected = {
  planResult: {
    [fileRelativePath]: {
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
