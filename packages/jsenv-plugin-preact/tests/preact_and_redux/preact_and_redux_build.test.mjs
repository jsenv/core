import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"
import { ensureEmptyDirectory } from "@jsenv/filesystem"
import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

import { plugins } from "./jsenv_config.mjs"

const test = async (params) => {
  await ensureEmptyDirectory(
    new URL("./client/.jsenv/cjs_to_esm", import.meta.url),
  )
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    plugins: [...plugins, jsenvPluginBundling()],
    writeGeneratedFiles: true,
    ...params,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = {
    returnValue,
  }
  const expected = {
    returnValue: {
      spanContentAfterIncrement: "1",
      spanContentAfterDecrement: "0",
    },
  }
  assert({ actual, expected })
}

// sometimes timeout on windows
if (process.platform !== "win32") {
  // support for <script type="module">
  await test({ runtimeCompat: { chrome: "64" } })
  // no support for <script type="module">
  await test({ runtimeCompat: { chrome: "62" } })
}
