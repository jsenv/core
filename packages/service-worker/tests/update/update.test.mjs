import { assert } from "@jsenv/assert"
import { readSnapshotsFromDirectory } from "@jsenv/core/tests/snapshots_directory.js"

const snapshotsHtmlDirectoryUrl = new URL("./snapshots/html/", import.meta.url)
const expected = readSnapshotsFromDirectory(snapshotsHtmlDirectoryUrl)
await import("./update_snapshots.mjs")
const actual = readSnapshotsFromDirectory(snapshotsHtmlDirectoryUrl)
assert({ actual, expected })
