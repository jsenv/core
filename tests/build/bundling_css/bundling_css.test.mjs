import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url)
const { buildFileContents } = await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  entryPoints: {
    "./elements.css": "elements.css",
  },
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  plugins: [jsenvPluginBundling()],
})
const expectedBuildFileContents = readSnapshotsFromDirectory(
  snapshotsDirectoryUrl,
)
writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
const actual = buildFileContents
const expected = expectedBuildFileContents
assert({ actual, expected })
