import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async ({ expectedFilename, ...params }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    writeGeneratedFiles: true,
    ...params,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = {
    answer: 42,
    nestedFeatureUrl: `${server.origin}/js/${expectedFilename}`,
  }
  assert({ actual, expected })
}

// can use <script type="module">
await test({
  runtimeCompat: { chrome: "89" },
  versioning: false,
  expectedFilename: `nested_feature.js`,
})
// cannot use <script type="module">
await test({
  runtimeCompat: { chrome: "62" },
  versioning: false,
  expectedFilename: `nested_feature.nomodule.js`,
})
