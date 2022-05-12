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
  const { status, namespace, consoleCalls } = await execute({
    // logLevel: "debug",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    fileRelativeUrl: `./main.html`,
    runtime,
    // runtimeParams: {
    //   headful: true,
    // },
    // keepRunning: true,
    mirrorConsole: false,
    collectConsole: true,
  })
  const actual = {
    status,
    namespace,
    consoleCalls,
  }
  const expected = {
    status: "completed",
    namespace: {
      "/main.js": {
        status: "completed",
        namespace: {},
      },
    },
    // there is also the html supervisor logs
    // we likely don't want them now
    consoleCalls: [
      {
        type: "log",
        text: `foo
`,
      },
      {
        type: "log",
        text: `bar
`,
      },
    ],
  }
  assert({ actual, expected })
}, Promise.resolve())
