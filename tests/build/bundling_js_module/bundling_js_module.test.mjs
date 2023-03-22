import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"

const test = async (params) => {
  const { buildFileContents } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    plugins: [jsenvPluginBundling()],
    ...params,
  })
  const actual = buildFileContents
  const expected = actual
  assert({ actual, expected })
}

await test()
