import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativePath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../../index.js"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativeUrl = `${testDirectoryRelativePath}.dist/`
const fileRelativeUrl = `${testDirectoryRelativePath}basic.main.js`

const { origin: browserExplorerServerOrigin } = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  compileDirectoryRelativeUrl,
})
const { browser, page } = await openBrowserPage(`${browserExplorerServerOrigin}${fileRelativeUrl}`)
const actual = await page.title()
const expected = `browser client index`
assert({ actual, expected })
browser.close()
