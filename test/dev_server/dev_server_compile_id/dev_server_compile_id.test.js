import {
  ensureEmptyDirectory,
  resolveUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

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
const fileRelativeUrl = `${testDirectoryRelativeUrl}main.html`
const devServer = await startDevServer({
  ...START_DEV_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { compileId } = await devServer.createCompileIdFromRuntimeReport({})
const { browser, page, getJsenvExecutionResult } = await openBrowserPage(
  `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`,
)
const getImportMetaUrl = async () => {
  const { executionResult } = await getJsenvExecutionResult()
  return executionResult.fileExecutionResultMap["./main.js"].namespace
    .importMetaUrl
}
try {
  // first execution works fine
  {
    const { importMetaUrl } = await getImportMetaUrl()
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`,
    }
    assert({ actual, expected })
  }

  // then we can delete .jsenv directory, and reload the page
  // -> it should still work
  {
    await ensureEmptyDirectory(new URL(".jsenv", import.meta.url))
    await page.reload()
    const { importMetaUrl } = await getImportMetaUrl()
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`,
    }
    assert({ actual, expected })
  }

  // then we can stop the dev server and restart a new one
  // -> it works and reuses the compileId
  {
    await devServer.stop()
    await startDevServer({
      ...START_DEV_SERVER_TEST_PARAMS,
      port: devServer.port,
      jsenvDirectoryRelativeUrl,
    })
    await page.reload()
    const { importMetaUrl } = await getImportMetaUrl()
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`,
    }
    assert({ actual, expected })
  }
} finally {
  browser.close()
}
