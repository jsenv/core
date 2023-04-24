import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"

const { buildFileContents } = await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  plugins: [jsenvPluginBundling()],
  versioning: false,
})
const server = await startFileServer({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
})
const { returnValue } = await executeInBrowser({
  url: `${server.origin}/main.html`,
  /* eslint-disable no-undef */
  pageFunction: () => window.namespacePromise,
  /* eslint-enable no-undef */
})
const actual = {
  buildFiles: Object.keys(buildFileContents),
  returnValue,
}
const expected = {
  buildFiles: ["css/main.css", "main.html"],
  returnValue: {
    bodyBackgroundColor: "rgb(255, 0, 0)",
  },
}
assert({ actual, expected })
