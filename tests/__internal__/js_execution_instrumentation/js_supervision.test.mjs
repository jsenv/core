import { readFileSync } from "node:fs"
import { assert } from "@jsenv/assert"
import { urlToRelativeUrl } from "@jsenv/urls"
import { comparePathnames } from "@jsenv/filesystem"

import { superviseJs } from "@jsenv/core/src/execute/js_supervision.js"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

let files = {}
const transformFile = async (url, { isJsModule } = {}) => {
  const code = await superviseJs({
    code: readFileSync(url, "utf8"),
    url: String(url),
    isJsModule,
  })
  const relativeUrl = urlToRelativeUrl(
    url,
    new URL("./fixtures/", import.meta.url),
  )

  files[relativeUrl] = code
  const filesSorted = {}
  Object.keys(files)
    .sort(comparePathnames)
    .forEach((relativeUrl) => {
      filesSorted[relativeUrl] = files[relativeUrl]
    })
  files = filesSorted

  return code
}
await transformFile(new URL("./fixtures/main.js", import.meta.url))
await transformFile(new URL("./fixtures/classic.js", import.meta.url), {
  isJsModule: false,
})
await transformFile(new URL("./fixtures/main.html", import.meta.url), {
  isJsModule: false,
})

const actual = files
const expected = readSnapshotsFromDirectory(
  new URL("./snapshots/", import.meta.url),
)
writeSnapshotsIntoDirectory(new URL("./snapshots/", import.meta.url), files)
assert({ actual, expected })
