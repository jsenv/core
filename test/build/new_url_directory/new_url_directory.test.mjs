/*
 * ce qu'on veut:
 * lorsqu'une ref pointe vers un dossier
 */

import { fileURLToPath } from "node:url"
import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/test/start_file_server.js"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    writeGeneratedFiles: true,
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
  const actual = returnValue
  const expected = {
    directoryUrl: new URL("./client/src/", import.meta.url).href,
  }
  assert({ actual, expected })
}

// by default referencing a directory throw an error
// try {
//   await test()
//   throw new Error("should throw")
// } catch (e) {
//   const actual = {
//     message: e.message,
//   }
//   const expected = {
//     message: `Failed to fetch url content
// --- reason ---
// found a directory on filesystem
// --- url ---
// ${new URL("./client/src/", import.meta.url).href}
// --- url reference trace ---
// ${fileURLToPath(new URL("./client/main.html", import.meta.url))}:15:40
//   14 |     <script type="module">
// > 15 |       const directoryUrl = new URL("./src/", import.meta.url).href
//                                               ^
//   16 |${" "}
// --- plugin name ---
// "jsenv:fetch_file_urls"`,
//   }
//   assert({ actual, expected })
// }

// but it can be allowed explicitely and it will copy the directory content
// in the build directory and update the url accorindgly
await test({
  directoryReferenceAllowed: true,
})
