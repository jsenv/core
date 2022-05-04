import { assert } from "@jsenv/assert"

import { execute, chromium, firefox, webkit } from "@jsenv/core"

// eslint-disable-next-line import/newline-after-import
;[
  // ensure multiline
  chromium,
  firefox,
  webkit,
].reduce(async (previous, runtime) => {
  await previous
  const { status, error, server, consoleCalls } = await execute({
    // logLevel: "debug"
    rootDirectoryUrl: new URL("./client/", import.meta.url),
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
    at triggerError (${server.origin}/trigger_error.js:2:9)
    at ${server.origin}/main.js:3:1`
      const actual = error.stack.slice(0, expected.length)
      assert({ actual, expected })
    },
    firefox: () => {
      const expected = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${server.origin}/trigger_error.js:2:9)
    at  (${server.origin}/main.js:2:1)`
      const actual = error.stack.slice(0, expected.length)
      assert({ actual, expected })
    },
    webkit: () => {
      const expected = `SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${server.origin}/trigger_error.js:2:56)
    at module code (${server.origin}/main.js:2:13)`
      const actual = error.stack.slice(0, expected.length)
      assert({ actual, expected })
    },
  }
  errorStackAssertions[runtime.name]()
}, Promise.resolve())
