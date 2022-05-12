import { assert } from "@jsenv/assert"

import { execute, chromium, firefox, webkit } from "@jsenv/core"

if (process.platform !== "win32") {
  // eslint-disable-next-line import/newline-after-import
  ;[
    // ensure multiline
    chromium,
    firefox,
    webkit,
  ].reduce(async (previous, runtime) => {
    await previous
    const { status, namespace, performance } = await execute({
      rootDirectoryUrl: new URL("./client/", import.meta.url),
      fileRelativeUrl: `./main.html`,
      runtime,
      mirrorConsole: false,
      collectConsole: true,
      collectPerformance: true,
    })
    const actual = {
      status,
      namespace,
      performance,
    }
    const expected = {
      status: "completed",
      namespace: {
        "/main.js": {
          status: "completed",
          namespace: {},
        },
      },
      performance: {
        timeOrigin: assert.any(Number),
        timing: actual.performance.timing,
        navigation: {
          type: 0,
          redirectCount: 0,
        },
        measures: {
          "a to b": assert.any(Number),
        },
      },
    }
    assert({ actual, expected })
  }, Promise.resolve())
}
