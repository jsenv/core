import { assert } from "@jsenv/assert"

import { execute, chromium, firefox, webkit } from "@jsenv/core"

const test = async ({ runtime }) => {
  const { status, error, consoleCalls } = await execute({
    // logLevel: "debug"
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    fileRelativeUrl: `./main.html`,
    runtime,
    mirrorConsole: false,
    collectConsole: true,
    ignoreError: true,
  })
  const actual = {
    status,
    error,
    consoleCalls,
  }
  const expected = {
    status: "errored",
    error: Object.assign(
      new Error(
        {
          chromium: "Unexpected end of input",
          firefox: "expected expression, got end of script",
          webkit: "Unexpected end of script",
        }[runtime.name],
      ),
      {
        name: "SyntaxError",
      },
    ),
    consoleCalls: [],
  }
  assert({ actual, expected })
}

await test({
  runtime: chromium,
})
await test({
  runtime: firefox,
})
await test({
  runtime: webkit,
})
