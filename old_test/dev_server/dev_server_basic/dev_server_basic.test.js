import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { START_DEV_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_DEV_SERVER.js"
import { openBrowserPage } from "@jsenv/core/test/open_browser_page.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}dev_server_basic.html`
const devServer = await startDevServer({
  ...START_DEV_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const htmlCompiledServerUrl = `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}redirect/${fileRelativeUrl}`
const { browser, page, pageLogs, pageErrors, getJsenvExecutionResult } =
  await openBrowserPage({
    // debug: true
  })
try {
  await page.goto(htmlCompiledServerUrl)
  await page.waitForNavigation()
  const executionResult = await getJsenvExecutionResult()
  const actual = { pageLogs, pageErrors, executionResult }
  const expected = {
    pageLogs: [
      { type: "log", text: "42" },
      { type: "log", text: "bar" },
    ],
    pageErrors: [],
    executionResult: {
      status: "completed",
      startTime: actual.executionResult.startTime,
      endTime: actual.executionResult.endTime,
      scriptExecutionResults: {
        "./dev_server_basic.js": {
          status: "completed",
          namespace: { default: 42 },
        },
      },
    },
  }
  assert({ actual, expected })
} finally {
  browser.close()
}
