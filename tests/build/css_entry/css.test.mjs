import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const { buildFileContents } = await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.css": "main.css",
  },
  plugins: [jsenvPluginBundling()],
})
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url)
const expectedBuildFileContents = readSnapshotsFromDirectory(
  snapshotsDirectoryUrl,
)
writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
const actual = buildFileContents
const expected = expectedBuildFileContents
assert({ actual, expected })
