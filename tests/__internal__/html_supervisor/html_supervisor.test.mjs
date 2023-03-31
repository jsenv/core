import { readFileSync } from "node:fs"
import { assert } from "@jsenv/assert"
import { urlToRelativeUrl } from "@jsenv/urls"
import { comparePathnames } from "@jsenv/filesystem"

import { injectSupervisorIntoHTML } from "@jsenv/core/src/plugins/supervisor/html_supervisor_injection.js"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

let files = {}
const transformFile = async (url) => {
  const code = await injectSupervisorIntoHTML({
    code: readFileSync(url, "utf8"),
    url: String(url),
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

await transformFile(new URL("./fixtures/main.html", import.meta.url))

const actual = files
const expected = readSnapshotsFromDirectory(
  new URL("./snapshots/", import.meta.url),
)
writeSnapshotsIntoDirectory(new URL("./snapshots/", import.meta.url), files)
assert({ actual, expected })
