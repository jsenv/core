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
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.main.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const filePath = urlToFileSystemPath(resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl))
const parentDirectoryUrl = resolveUrl("../", testDirectoryUrl)
const parentDirectoryRelativeUrl = urlToRelativeUrl(parentDirectoryUrl, jsenvCoreDirectoryUrl)
const htmlFileRelativeUrl = `${parentDirectoryRelativeUrl}template.html`

const { exploringServer } = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  htmlFileRelativeUrl,
  livereloading: true,
})
const { browser, page, pageLogs, pageErrors, executionResult } = await openBrowserPage(
  `${exploringServer.origin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`,
  {
    headless: false,
  },
)
{
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
}
{
  await writeFileSystemNodeModificationTime(filePath, Date.now())
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await page.waitFor(() => Boolean(window.__executionResult__))
  const afterReloadExecutionResult = await page.evaluate(() => window.__executionResult__)
  const actual = afterReloadExecutionResult.namespace
  const expected = {
    default: 43,
  }
  assert({ actual, expected })
}
exploringServer.stop()
browser.close()
