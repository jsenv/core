import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "@jsenv/core/index.js"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

const exploringServer = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  importMetaEnvFileRelativeUrl: `${testDirectoryRelativeUrl}env.js`,
  jsenvDirectoryRelativeUrl,
})
const {
  browser,
  pageLogs,
  pageErrors,
  executionResult,
} = await openBrowserPage(
  `${exploringServer.origin}/${exploringServer.outDirectoryRelativeUrl}otherwise/${fileRelativeUrl}`,
  { headless: false },
)
const actual = { pageLogs, pageErrors, executionResult }
const expected = {
  pageLogs: [],
  pageErrors: [],
  executionResult: {
    status: "completed",
    startTime: actual.executionResult.startTime,
    endTime: actual.executionResult.endTime,
    fileExecutionResultMap: {
      "./import-meta-env.js": {
        status: "completed",
        namespace: { default: 42 },
      },
    },
  },
}
// assert({ actual, expected })
// browser.close()
