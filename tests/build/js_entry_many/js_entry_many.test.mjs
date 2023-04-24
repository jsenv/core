import { copyFileSync } from "node:fs"
import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"

await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  entryPoints: {
    "./a.js": "a.js",
    "./b.js": "b.js",
  },
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
})
copyFileSync(
  new URL("./client/a.html", import.meta.url),
  new URL("./dist/a.html", import.meta.url),
)
copyFileSync(
  new URL("./client/b.html", import.meta.url),
  new URL("./dist/b.html", import.meta.url),
)
const server = await startFileServer({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
})
const aExecution = await executeInBrowser({
  url: `${server.origin}/a.html`,
  /* eslint-disable no-undef */
  pageFunction: () => window.resultPromise,
  /* eslint-enable no-undef */
})
const bExecution = await executeInBrowser({
  url: `${server.origin}/b.html`,
  /* eslint-disable no-undef */
  pageFunction: () => window.resultPromise,
  /* eslint-enable no-undef */
})
const actual = {
  aReturnValue: aExecution.returnValue,
  bReturnValue: bExecution.returnValue,
}
const expected = {
  aReturnValue: "a-shared",
  bReturnValue: "b-shared",
}
assert({ actual, expected })
