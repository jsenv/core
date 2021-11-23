import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { START_DEV_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_DEV_SERVER.js"
import { openBrowserPage } from "@jsenv/core/test/openBrowserPage.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `dev_server_basic.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const devServer = await startDevServer({
  ...START_DEV_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { browser, pageLogs, pageErrors, executionResult } =
  await openBrowserPage(
    `${devServer.origin}/${devServer.outDirectoryRelativeUrl}otherwise/${fileRelativeUrl}`,
    // { headless: false },
  )

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
    fileExecutionResultMap: {
      "./dev_server_basic.js": {
        status: "completed",
        namespace: { default: 42 },
      },
    },
  },
}
assert({ actual, expected })
browser.close()
