import { assert } from "@jsenv/assert"

import { startDevServer, execute, chromium, firefox, webkit } from "@jsenv/core"

const test = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  })
  const { status, namespace, performance } = await execute({
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    devServerOrigin: devServer.origin,
    fileRelativeUrl: `./main.html`,
    runtime,
    mirrorConsole: false,
    collectConsole: true,
    collectPerformance: true,
  })
  devServer.stop()
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
}

if (process.platform !== "win32") {
  await test({ runtime: chromium })
  await test({ runtime: firefox })
  await test({ runtime: webkit })
}
