import { assert } from "@jsenv/assert"

import { startDevServer, execute, chromium, firefox, webkit } from "@jsenv/core"

const test = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  })
  const { errors } = await execute({
    // logLevel: "debug"
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    devServerOrigin: devServer.origin,
    fileRelativeUrl: `./main.html`,
    runtime,
    mirrorConsole: false,
    collectConsole: true,
    ignoreError: true,
  })
  devServer.stop()
  if (runtime === chromium) {
    const actual = errors[0].reason
    const expected = "SyntaxError: Unexpected end of input"
    assert({ actual, expected })
  }
  if (runtime === firefox) {
    const actual = errors[0].reason
    const expected = "SyntaxError: expected expression, got end of script\n"
    assert({ actual, expected })
  }
  if (runtime === webkit) {
    const actual = errors[0].message
    const expected = `Unexpected end of script`
    assert({ actual, expected })
  }
}

await test({ runtime: chromium })
if (process.platform !== "win32") {
  await test({ runtime: firefox })
}
await test({ runtime: webkit })
