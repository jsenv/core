import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  urlToRelativeUrl,
  urlToFileSystemPath,
  resolveUrl,
  writeFileSystemNodeModificationTime,
} from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../../index.js"
import { openBrowserPage, getHtmlExecutionResult } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.main.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const filePath = urlToFileSystemPath(resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl))

const exploringServer = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  livereloading: true,
})
const { browser, page, pageLogs, pageErrors, executionResult } = await openBrowserPage(
  `${exploringServer.origin}/${exploringServer.outDirectoryRelativeUrl}otherwise/${fileRelativeUrl}`,
  {
    // headless: false,
  },
)
{
  const actual = { pageLogs, pageErrors, executionResult }
  const expected = {
    pageLogs: [],
    pageErrors: [],
    executionResult: {
      status: "completed",
      startTime: assert.any(Number),
      endTime: assert.any(Number),
      fileExecutionResultMap: {
        "@jsenv/core/src/toolbar.js": {
          status: "completed",
          namespace: {},
        },
        "./livereload.main.js": {
          status: "completed",
          namespace: { default: 42 },
        },
      },
    },
  }
  assert({ actual, expected })
}
{
  await new Promise((resolve) => setTimeout(resolve, 4000)) // give time to the toolbar to connect to SSE
  const navigationPromise = page.waitForNavigation()
  writeFileSystemNodeModificationTime(filePath, Date.now())
  await navigationPromise
  const afterReloadExecutionResult = await getHtmlExecutionResult(page)
  const actual = afterReloadExecutionResult.fileExecutionResultMap["./livereload.main.js"].namespace
  const expected = {
    default: 43,
  }
  assert({ actual, expected })
}
exploringServer.stop()
browser.close()
