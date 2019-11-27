import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  fileUrlToPath,
  resolveUrl,
} from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../../index.js"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"
import { changeFileModificationDate } from "../changeFileModificationDate.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const htmlFileUrl = import.meta.resolve("../template.html")
const htmlFileRelativeUrl = urlToRelativeUrl(htmlFileUrl, jsenvCoreDirectoryUrl)
const filename = `${testDirectoryBasename}.main.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`
const filePath = fileUrlToPath(resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl))

const { origin: browserExplorerServerOrigin, stop } = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  htmlFileUrl,
  livereloading: true,
})
const { browser, page, pageLogs, pageErrors, executionResult } = await openBrowserPage(
  `${browserExplorerServerOrigin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`,
  { headless: true },
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

stop()
browser.close()
