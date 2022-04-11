import {
  ensureEmptyDirectory,
  resolveUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { START_DEV_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_DEV_SERVER.js"
import { openBrowserPage } from "@jsenv/core/test/open_browser_page.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlRelativeUrl = `${testDirectoryRelativeUrl}main.html`
const devServer = await startDevServer({
  ...START_DEV_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { compileId } = await devServer.createCompileIdFromRuntimeReport({})
const compileDirectoryServerUrl = `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}${compileId}/`
const htmlCompiledServerUrl = `${compileDirectoryServerUrl}${htmlRelativeUrl}`
const { browser, page, getJsenvExecutionResult } = await openBrowserPage({
  // debug: true,
})
await page.goto(htmlCompiledServerUrl)

const getImportMetaUrl = async () => {
  const executionResult = await getJsenvExecutionResult()
  return {
    importMetaUrl:
      executionResult.scriptExecutionResults["./main.js"].namespace
        .importMetaUrl,
  }
}
try {
  // first execution works fine
  {
    const { importMetaUrl } = await getImportMetaUrl()
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `${compileDirectoryServerUrl}${testDirectoryRelativeUrl}main.js`,
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
      importMetaUrl: `${compileDirectoryServerUrl}${testDirectoryRelativeUrl}main.js`,
    }
    assert({ actual, expected })
  }

  // then we can stop the dev server and restart a new one
  // -> it works, but gets a fresh compileId because:
  // 1. __jsenv_meta__.json was deleted
  // 2. server was restarted
  {
    await devServer.stop()
    await startDevServer({
      ...START_DEV_SERVER_TEST_PARAMS,
      port: new URL(devServer.origin).port,
      jsenvDirectoryRelativeUrl,
    })
    await page.goto(htmlCompiledServerUrl)
    await page.waitForNavigation()
    const { importMetaUrl } = await getImportMetaUrl()
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `${devServer.origin}/${testDirectoryRelativeUrl}main.js`,
    }
    assert({ actual, expected })
  }
} finally {
  browser.close()
}
