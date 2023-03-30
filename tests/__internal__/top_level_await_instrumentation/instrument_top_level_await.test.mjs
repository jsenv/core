import { readFileSync } from "node:fs"
import { assert } from "@jsenv/assert"
import { urlToRelativeUrl } from "@jsenv/urls"

import { instrumentTopLevelAwait } from "@jsenv/core/src/test/top_level_await/instrument_top_level_await.js"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const files = {}
const transformFile = async (url) => {
  const code = await instrumentTopLevelAwait({
    code: readFileSync(url, "utf8"),
    url: String(url),
  })
  const relativeUrl = urlToRelativeUrl(
    url,
    new URL("./fixtures/", import.meta.url),
  )
  files[relativeUrl] = code

  return code
}
await transformFile(new URL("./fixtures/main.js", import.meta.url))

const actual = files
const expected = readSnapshotsFromDirectory(
  new URL("./snapshots/", import.meta.url),
)
writeSnapshotsIntoDirectory(new URL("./snapshots/", import.meta.url), files)
assert({ actual, expected })
