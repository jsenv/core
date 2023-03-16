import { assert } from "@jsenv/assert"
import { readSnapshotsFromDirectory } from "@jsenv/core/tests/snapshots_directory.js"

// https certificate only generated on linux
if (process.platform === "linux") {
  const snapshotsHtmlDirectoryUrl = new URL(
    "./snapshots/html/",
    import.meta.url,
  )
  const expected = readSnapshotsFromDirectory(snapshotsHtmlDirectoryUrl)
  process.env.FROM_TESTS = "true"
  await import("./update_snapshots.mjs")
  const actual = readSnapshotsFromDirectory(snapshotsHtmlDirectoryUrl)
  assert({ actual, expected })
}
