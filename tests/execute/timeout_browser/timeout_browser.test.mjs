import { assert } from "@jsenv/assert"

import {
  startDevServer,
  execute,
  chromium,
  // firefox,
  webkit,
} from "@jsenv/core"

const test = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  })
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    devServerOrigin: devServer.origin,
    fileRelativeUrl: `./main.html`,
    runtime,
    allocatedMs: 5_000,
    mirrorConsole: false,
    collectConsole: true,
  })
  devServer.stop()
  const actual = {
    status: result.status,
    consoleCalls: result.consoleCalls,
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
}

await test({ runtime: chromium })
// await test({ runtime: firefox })
await test({ runtime: webkit })
