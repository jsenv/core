import { readFileSync } from "node:fs"
import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    writeGeneratedFiles: true,
    minification: false,
    ...params,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.resultPromise
    },
    /* eslint-enable no-undef */
  })
  const actual = {
    returnValue,
    jsFileContent: String(
      readFileSync(new URL("./dist/src/sub/file.js", import.meta.url)),
    ),
  }
  const expected = {
    returnValue: {
      directoryUrl: `${server.origin}/src/?v=82a2c375`,
    },
    jsFileContent: `console.log("Hello");`,
  }
  assert({ actual, expected })
}

// by default referencing a directory throw an error
try {
  await test()
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `Failed to fetch url content
--- reason ---
found a directory on filesystem
--- url ---
${new URL("./client/src/", import.meta.url).href}
--- url reference trace ---
${new URL("./client/main.html", import.meta.url)}:15:40
  14 |     <script type="module">
> 15 |       const directoryUrl = new URL("./src/", import.meta.url).href
                                              ^
  16 | `
  assert({ actual, expected })
}

// but it can be allowed explicitely and it will copy the directory content
// in the build directory and update the url accorindgly
await test({ directoryReferenceAllowed: true })
