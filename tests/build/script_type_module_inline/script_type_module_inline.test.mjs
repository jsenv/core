import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async ({ expectedUrl, ...rest }) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    writeGeneratedFiles: true,
    ...rest,
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
    answer: 42,
    url: `${server.origin}${expectedUrl}`,
  }
  assert({ actual, expected })
}

// support + bundling
await test({
  runtimeCompat: { chrome: "64" },
  plugins: [jsenvPluginBundling()],
  versioning: false,
  expectedUrl: "/main.html",
})
// no support + bundling
await test({
  runtimeCompat: { chrome: "60" },
  plugins: [jsenvPluginBundling()],
  versioning: false,
  expectedUrl: "/main.html__inline_script__1",
})
// no support + no bundling
await test({
  runtimeCompat: { chrome: "60" },
  versioning: false,
  expectedUrl: "/main.html__inline_script__1",
})
// no support + no bundling + versioning
await test({
  runtimeCompat: { chrome: "60" },
  versioning: true,
  expectedUrl: "/main.html__inline_script__1",
})
