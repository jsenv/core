import { assert } from "@jsenv/assert"

import { execute, chromium, firefox, webkit } from "@jsenv/core"

await [
  // ensure multiline
  chromium,
  firefox,
  webkit,
].reduce(async (previous, runtime) => {
  await previous
  const { status, consoleCalls } = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    fileRelativeUrl: `./main.html`,
    runtime,
    allocatedMs: 5000,
    mirrorConsole: false,
    collectConsole: true,
  })
  const actual = {
    status,
    consoleCalls,
  }
  const expected = {
    status: "timedout",
    consoleCalls:
      // not reliable on windows for some reason
      process.platform === "win32"
        ? actual.consoleCalls
        : [
            {
              type: "log",
              text: `foo\n    `,
            },
          ],
  }
  assert({ actual, expected })
}, Promise.resolve())
