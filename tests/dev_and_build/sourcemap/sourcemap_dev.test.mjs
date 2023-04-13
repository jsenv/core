import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  const consoleErrorMessages = []
  const consoleError = console.error
  console.error = (message) => {
    consoleErrorMessages.push(message)
  }
  try {
    const devServer = await startDevServer({
      logLevel: "warn",
      clientAutoreload: false,
      ribbon: false,
      supervisor: false,
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      keepProcessAlive: false,
      outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
      ...params,
    })
    await executeInChromium({
      url: `${devServer.origin}/main.html`,
      /* eslint-disable no-undef */
      pageFunction: () => {
        return window.sourcemapFetchPromise
      },
      /* eslint-disable no-undef */
    })
    const actual = consoleErrorMessages
    const expected = []
    assert({ actual, expected })
  } finally {
    console.error = consoleError
  }
}

await test()
