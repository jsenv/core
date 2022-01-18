import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { START_DEV_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_DEV_SERVER.js"
import { openBrowserPage } from "@jsenv/core/test/openBrowserPage.js"

const { server } = await import("./server/serve.js")
try {
  const testDirectoryUrl = resolveUrl("./", import.meta.url)
  const testDirectoryRelativeUrl = urlToRelativeUrl(
    testDirectoryUrl,
    jsenvCoreDirectoryUrl,
  )
  const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
  const fileRelativeUrl = `${testDirectoryRelativeUrl}main.html`
  const getExecutionInfo = async (params) => {
    const devServer = await startDevServer({
      ...START_DEV_SERVER_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      ...params,
    })
    const { browser, pageLogs, pageErrors, executionResult } =
      await openBrowserPage(
        `${devServer.origin}/${devServer.outDirectoryRelativeUrl}otherwise/${fileRelativeUrl}`,
        {
          // debug: true,
          /* eslint-disable no-undef */
          pageFunction: () => {
            return window.answer
          },
          /* eslint-enable no-undef */
        },
      )
    browser.close()
    return {
      pageLogs,
      pageErrors,
      executionResult,
    }
  }

  // default behaviour
  {
    const { pageLogs, pageErrors, executionResult } = await getExecutionInfo()
    const actual = {
      pageLogs,
      pageErrors,
      executionResult,
    }
    const expected = {
      pageLogs: [],
      pageErrors: [],
      executionResult: 42,
    }
    assert({ actual, expected })
  }

  // allowing to fetch remote url
  {
    const { pageLogs, pageErrors, executionResult } = await getExecutionInfo({
      preservedUrls: {
        "http://127.0.0.1:9999/": false,
      },
    })
    const actual = {
      pageLogs,
      pageErrors,
      executionResult,
    }
    const expected = {
      pageLogs: [],
      pageErrors: [],
      executionResult: 42,
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
