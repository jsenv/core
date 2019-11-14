import { assert } from "@dmail/assert"
import { startExploringServer } from "../../index.js"
import { fileHrefToFolderRelativePath } from "../file-href-to-folder-relative-path.js"
import { openBrowserPage } from "../open-browser-page.js"
import { EXPLORING_SERVER_TEST_PARAM } from "../exploring-server-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativePath = `${folderRelativePath}/throw.main.js`

const { origin: browserExplorerServerOrigin } = await startExploringServer({
  ...EXPLORING_SERVER_TEST_PARAM,
  compileIntoRelativePath,
})
const { browser, page } = await openBrowserPage(`${browserExplorerServerOrigin}${fileRelativePath}`)
const actual = await page.title()
assert({ actual, expected: `browser client index` })
browser.close()
