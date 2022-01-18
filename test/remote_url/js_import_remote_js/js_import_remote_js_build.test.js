import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const { server } = await import("./script/serve.js")
try {
  const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
  const testDirectoryRelativeUrl = urlToRelativeUrl(
    testDirectoryUrl,
    jsenvCoreDirectoryUrl,
  )
  const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
  const entryPoints = {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  }

  // esmodule default (http url preserved)
  {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      entryPoints,
      format: "esmodule",
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/esmodule/`,
    })
    const jsBuildRelativeUrl =
      buildMappings[`${testDirectoryRelativeUrl}main.js`]
    const { returnValue } = await executeInBrowser({
      directoryUrl: new URL("./", import.meta.url),
      htmlFileRelativeUrl: "./dist/esmodule/main.html",
      /* eslint-disable no-undef */
      pageFunction: async (jsBuildRelativeUrl) => {
        const namespace = await import(jsBuildRelativeUrl)
        return namespace
      },
      /* eslint-enable no-undef */
      pageArguments: [jsBuildRelativeUrl],
    })
    const actual = {
      returnValue,
    }
    const expected = {
      returnValue: {
        url: `${server.origin}/constants.js?foo=bar`,
      },
    }
    assert({ actual, expected })
  }

  // esmodule + http url not preserved
  {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/esmodule/`,
      format: "esmodule",
      preservedUrls: {
        "http://localhost:9999/": false,
      },
    })
    const jsBuildRelativeUrl =
      buildMappings[`${testDirectoryRelativeUrl}main.js`]
    const { returnValue, serverOrigin } = await executeInBrowser({
      directoryUrl: new URL("./", import.meta.url),
      htmlFileRelativeUrl: "./dist/esmodule/main.html",
      /* eslint-disable no-undef */
      pageFunction: async (jsBuildRelativeUrl) => {
        const namespace = await import(jsBuildRelativeUrl)
        return namespace
      },
      /* eslint-enable no-undef */
      pageArguments: [jsBuildRelativeUrl],
    })
    const actual = {
      returnValue,
    }
    const expected = {
      returnValue: {
        url: `${serverOrigin}/dist/esmodule/${jsBuildRelativeUrl}`,
      },
    }
    assert({ actual, expected })
  }

  // Systemjs url preserved
  {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      entryPoints,
      format: "systemjs",
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/systemjs/`,
    })
    const jsBuildRelativeUrl =
      buildMappings[`${testDirectoryRelativeUrl}main.js`]
    try {
      await executeInBrowser({
        directoryUrl: new URL("./", import.meta.url),
        htmlFileRelativeUrl: "./dist/esmodule/main.html",
        /* eslint-disable no-undef */
        pageFunction: async (jsBuildRelativeUrl) => {
          const namespace = await import(jsBuildRelativeUrl)
          return namespace
        },
        /* eslint-enable no-undef */
        pageArguments: [jsBuildRelativeUrl],
      })
      throw new Error("should throw")
    } catch (e) {
      const messageIncludesFetchError = e.message.includes(
        `Failed to fetch dynamically imported module`,
      )
      const actual = { messageIncludesFetchError }
      const expected = { messageIncludesFetchError: true }
      assert({ actual, expected })
    }
  }

  // systemjs + http url not preserved
  {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/systemjs/`,
      format: "systemjs",
      preservedUrls: {
        "http://localhost:9999/": false,
      },
    })
    const jsBuildRelativeUrl =
      buildMappings[`${testDirectoryRelativeUrl}main.js`]
    const { returnValue, serverOrigin } = await executeInBrowser({
      directoryUrl: new URL("./", import.meta.url),
      htmlFileRelativeUrl: "./dist/systemjs/main.html",
      /* eslint-disable no-undef */
      pageFunction: (jsBuildRelativeUrl) => {
        return window.System.import(`./${jsBuildRelativeUrl}`)
      },
      /* eslint-enable no-undef */
      pageArguments: [jsBuildRelativeUrl],
    })
    const actual = {
      returnValue,
    }
    const expected = {
      namespace: {
        url: `${serverOrigin}/dist/systemjs/${jsBuildRelativeUrl}`,
      },
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
