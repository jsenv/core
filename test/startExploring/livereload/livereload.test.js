import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToFilePath,
  resolveUrl,
} from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../../index.js"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"
import { changeFileModificationDate } from "../changeFileModificationDate.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileUrl = import.meta.resolve("../template.html")
const htmlFileRelativeUrl = urlToRelativeUrl(htmlFileUrl, jsenvCoreDirectoryUrl)
const filename = `${testDirectoryname}.main.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const filePath = urlToFilePath(resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl))

const { exploringServer } = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  htmlFileUrl,
  livereloading: true,
})
const { browser, page, pageLogs, pageErrors, executionResult } = await openBrowserPage(
  `${exploringServer.origin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`,
  {
    headless: true,
  },
)
const actual = { pageLogs, pageErrors, executionResult }
const expected = {
  pageLogs: [],
  pageErrors: [],
  executionResult: {
    status: "completed",
    namespace: { default: 42 },
  },
}
assert({ actual, expected })

await changeFileModificationDate(filePath, new Date(Date.now() + 1001))
await new Promise((resolve) => setTimeout(resolve, 1000))

await page.waitFor(() => Boolean(window.__executionResult__))
const afterReloadExecutionResult = await page.evaluate(() => window.__executionResult__)
{
  const actual = afterReloadExecutionResult.namespace
  const expected = {
    default: 43,
  }
  assert({ actual, expected })
}

exploringServer.stop()
browser.close()
