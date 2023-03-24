import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const test = async (params) => {
  const { buildFileContents } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.css": "main.css",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  })
  const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url)
  const snapshotsFileContent = readSnapshotsFromDirectory(snapshotsDirectoryUrl)
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
  const actual = buildFileContents
  const expected = snapshotsFileContent
  assert({ actual, expected })
}

await test()
