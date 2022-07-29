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
    mirrorConsole: false,
    collectConsole: true,
    ignoreError: true,
  })
  devServer.stop()
  const actual = {
    status,
    error,
    consoleCalls,
  }
  const expected = {
    status: "errored",
    error: {
      chromium: () => {
        const error = new Error("Unexpected end of input")
        Object.assign(error, { name: "SyntaxError" })
        return error
      },
      firefox: () => {
        const syntaxError = new SyntaxError(
          "expected expression, got end of script",
        )
        Object.defineProperties(syntaxError, {
          fileName: {
            configurable: true,
            writable: true,
            value: `${devServer.origin}/js_syntax_error.js`,
          },
          lineNumber: {
            configurable: true,
            writable: true,
            value: 1,
          },
          columnNumber: {
            configurable: true,
            writable: true,
            value: 11,
          },
        })
        return syntaxError
      },
      webkit: () => {
        const error = new Error("Unexpected end of script")
        Object.assign(error, { name: "SyntaxError" })
        return error
      },
    }[runtime.name](),
    consoleCalls: [],
  }
  assert({ actual, expected })
}

await test({ runtime: chromium })
await test({ runtime: firefox })
await test({ runtime: webkit })
