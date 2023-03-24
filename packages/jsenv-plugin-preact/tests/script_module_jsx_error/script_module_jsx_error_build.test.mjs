import { assert } from "@jsenv/assert"
import { build } from "@jsenv/core"

const test = async (params) => {
  await build({
    logLevel: "off",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.noeslint.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  })
}

try {
  await test({
    runtimeCompat: { chrome: "64" },
  })
  throw new Error("should throw")
} catch (e) {
  const actual = {
    stackStartsWithUnexpectedToken: e.stack.startsWith(
      "Error: Unexpected token (9:15)",
    ),
  }
  const expected = {
    stackStartsWithUnexpectedToken: true,
  }
  assert({ actual, expected })
}
