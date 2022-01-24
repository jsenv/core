import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { START_DEV_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_DEV_SERVER.js"
import { openBrowserPage } from "@jsenv/core/test/open_browser_page.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlRelativeUrl = `${testDirectoryRelativeUrl}preload_script.html`
const devServer = await startDevServer({
  ...START_DEV_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { compileId } = await devServer.createCompileIdFromRuntimeReport({
  forceCompilation: true,
})
const htmlCompiledRelativeUrl = `${devServer.jsenvDirectoryRelativeUrl}${compileId}/${htmlRelativeUrl}`
const urlToVisit = `${devServer.origin}/${htmlCompiledRelativeUrl}`
const { browser, page, pageLogs, pageErrors } = await openBrowserPage({
  // debug: true
})
await page.goto(urlToVisit)
const actual = {
  pageLogs,
  pageErrors,
}
const expected = {
  pageLogs: [], // ensure there is no warning about preload link not used
  pageErrors: [],
}
assert({ actual, expected })
browser.close()
