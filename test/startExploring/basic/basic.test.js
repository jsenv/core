import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../../index.js"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativePath = `${testDirectoryRelativePath}.dist/`
const fileRelativePath = `${testDirectoryRelativePath}basic.main.js`

const { origin: browserExplorerServerOrigin } = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  compileDirectoryRelativePath,
})
const { browser, page } = await openBrowserPage(`${browserExplorerServerOrigin}${fileRelativePath}`)
const actual = await page.title()
const expected = `browser client index`
assert({ actual, expected })
browser.close()
