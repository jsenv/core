import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"

const test = async ({ expectedUrl, ...rest }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    versioning: false,
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...rest,
  })

  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = {
    answer: 42,
    url: `${server.origin}${expectedUrl}`,
  }
  assert({ actual, expected })
}

// can use <script type="module">
await test({
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginBundling()],
  expectedUrl: "/js/main.js",
})
// cannot use <script type="module">
await test({
  runtimeCompat: { chrome: "60" },
  plugins: [jsenvPluginBundling()],
  expectedUrl: "/js/main.nomodule.js",
})
// cannot use + no bundling
await test({
  runtimeCompat: { chrome: "60" },
  expectedUrl: `/js/main.nomodule.js`,
})
