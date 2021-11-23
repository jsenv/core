import { assert } from "@jsenv/assert"
import {
  urlToRelativeUrl,
  urlToFileSystemPath,
  resolveUrl,
  writeFileSystemNodeModificationTime,
  urlToBasename,
} from "@jsenv/filesystem"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  openBrowserPage,
  getHtmlExecutionResult,
} from "@jsenv/core/test/openBrowserPage.js"
import { START_DEV_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_DEV_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const filePath = urlToFileSystemPath(
  resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl),
)

const devServer = await startDevServer({
  ...START_DEV_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  livereloading: true,
})
const { browser, page, pageLogs, pageErrors, executionResult } =
  await openBrowserPage(
    `${devServer.origin}/${devServer.outDirectoryRelativeUrl}otherwise/${fileRelativeUrl}`,
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
        "./dev_server_livereload.js": {
          status: "completed",
          namespace: { default: 42 },
        },
      },
    },
  }
  assert({ actual, expected })
}

// perform a file change while toolbar is not connected
{
  const navigationPromise = page.waitForNavigation({ timeout: 0 })
  writeFileSystemNodeModificationTime(filePath, Date.now())
  await navigationPromise
  const afterReloadExecutionResult = await getHtmlExecutionResult(page)
  const actual =
    afterReloadExecutionResult.fileExecutionResultMap[
      "./dev_server_livereload.js"
    ].namespace
  const expected = {
    default: 43,
  }
  assert({ actual, expected })
}

// here give time to toolbar to connect to sse
{
  await new Promise((resolve) => setTimeout(resolve, 10000)) // give time to the toolbar to connect to SSE
  const navigationPromise = page.waitForNavigation()
  writeFileSystemNodeModificationTime(filePath, Date.now())
  await navigationPromise
  const afterReloadExecutionResult = await getHtmlExecutionResult(page)
  const actual =
    afterReloadExecutionResult.fileExecutionResultMap[
      "./dev_server_livereload.js"
    ].namespace
  const expected = {
    default: 44,
  }
  assert({ actual, expected })
}
devServer.stop()
browser.close()
