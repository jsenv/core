import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { START_EXPLORING_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXPLORING.js"
import { openBrowserPage } from "@jsenv/core/test/openBrowserPage.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `preload_script.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const devServer = await startDevServer({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { browser, pageLogs, pageErrors } = await openBrowserPage(
  `${devServer.origin}/${devServer.outDirectoryRelativeUrl}otherwise/${fileRelativeUrl}`,
  {
    // debug: true,
  },
)

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
