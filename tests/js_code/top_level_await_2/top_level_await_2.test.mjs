import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async ({ systemJsBug, ...params }) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    minification: false,
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
  const expected = [
    "a_before_timeout",
    ...(systemJsBug ? [] : ["a_after_timeout"]),
    "before_import_a",
    "after_import_a",
  ]
  assert({ actual, expected })
}

// support for top level await and <script type="module">
await test({
  runtimeCompat: {
    chrome: "89",
  },
  bundling: false,
})

// no support for top <script type="module">
await test({
  runtimeCompat: {
    chrome: "55",
  },
  bundling: false,
  systemJsBug: true,
})

// support for <script type="module"> but not TLA
// Considering that TLA + export on old runtimes is not recommended:
// - TLA should be reserved to entry points where exports are not needed)
// - It would be overkill to use systemjs only because code uses TLA + export
// -> Jsenv throw an error when TLA + exports is used and systemjs is not
// (ideally jsenv would throw a custom error explaining all this)
try {
  await test({
    runtimeCompat: {
      chrome: "65",
    },
    bundling: false,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message.includes(
    'Cannot export after a top-level await when using topLevelAwait: "simple"!',
  )
  const expected = true
  assert({ actual, expected })
}
