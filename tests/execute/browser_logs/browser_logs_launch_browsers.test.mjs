import { assert } from "@jsenv/assert"

import { startDevServer, execute, chromium, firefox, webkit } from "@jsenv/core"

const test = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  })
  const { status, namespace, consoleCalls } = await execute({
    // logLevel: "debug",
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
  })
  devServer.stop()
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
        error: null,
        namespace: {},
        coverage: null,
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
}

await test({ runtime: chromium })
await test({ runtime: firefox })
await test({ runtime: webkit })
