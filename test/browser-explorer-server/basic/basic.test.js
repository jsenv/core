import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startBrowserExplorerServer } from "../../../src/browser-explorer-server/index.js"
import { openBrowserPage } from "../open-browser-page.js"
import { BROWSER_EXPLORER_SERVER_TEST_PARAM } from "../browser-explorer-server-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/basic.main.js`

const { origin: browserExplorerServerOrigin } = await startBrowserExplorerServer({
  ...BROWSER_EXPLORER_SERVER_TEST_PARAM,
  compileIntoRelativePath,
})
const { browser, page } = await openBrowserPage(`${browserExplorerServerOrigin}${fileRelativePath}`)
const actual = await page.title()
assert({ actual, expected: `browser client index` })
browser.close()
