import { assert } from "@jsenv/assert"
import { build } from "@jsenv/core"
import {
  writeSnapshotsIntoDirectory,
  readSnapshotsFromDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

const test = async ({ name, ...rest }) => {
  const snapshotsDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url)
  const { buildFileContents } = await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    runtimeCompat: { chrome: "90" },
    writeGeneratedFiles: true,
    ...rest,
  })
  const expected = readSnapshotsFromDirectory(snapshotsDirectoryUrl)
  const actual = buildFileContents
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
  assert({ actual, expected })
}

await test({
  name: "vendor_chunk",
  plugins: [jsenvPluginBundling()],
})

await test({
  name: "vendor_chunk_disabled",
  plugins: [
    jsenvPluginBundling({
      js_module: {
        chunks: {
          vendors: null,
        },
      },
    }),
  ],
})
