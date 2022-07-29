import { assert } from "@jsenv/assert"

import { startDevServer, execute, chromium, firefox, webkit } from "@jsenv/core"

const test = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  })
  const { status, error, consoleCalls } = await execute({
    // logLevel: "debug"
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    devServerOrigin: devServer.origin,
    fileRelativeUrl: `./main.html`,
    runtime,
    // runtimeParams: {
    //   headful: true,
    // },
    // keepRunning: true,
    mirrorConsole: false,
    collectConsole: true,
    ignoreError: true,
  })
  devServer.stop()

  const actual = {
    status,
    errorMessage: error.message,
    consoleCalls,
  }
  const expected = {
    status: "errored",
    errorMessage: "SPECIAL_STRING_UNLIKELY_TO_COLLIDE",
    consoleCalls: [],
  }
  assert({ actual, expected })

  // error stack
  const errorStackAssertions = {
    chromium: () => {
      const expected = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${devServer.origin}/trigger_error.js:2:9)
    at ${devServer.origin}/main.js:3:1`
      const actual = error.stack.slice(0, expected.length)
      assert({ actual, expected })
    },
    firefox: () => {
      const expected = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${devServer.origin}/trigger_error.js:2:9)
    at  (${devServer.origin}/main.js:2:1)`
      const actual = error.stack.slice(0, expected.length)
      assert({ actual, expected })
    },
    webkit: () => {
      const expected = `SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at reportError (${devServer.origin}/trigger_error.js:2:18)
    at unknown (${devServer.origin}`
      const actual = error.stack.slice(0, expected.length)
      assert({ actual, expected })
    },
  }
  errorStackAssertions[runtime.name]()
}

await test({ runtime: chromium })
await test({ runtime: firefox })
await test({ runtime: webkit })
