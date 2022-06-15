import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/urls"

import {
  ensureEmptyDirectory,
  writeEntryModificationTime,
  readEntryModificationTime,
  writeFile,
} from "@jsenv/filesystem"
import { toSecondsPrecision } from "@jsenv/filesystem/test/testHelpers.js"

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)
await ensureEmptyDirectory(tempDirectoryUrl)

{
  const sourceUrl = resolveUrl("file.txt", tempDirectoryUrl)
  const mtime = toSecondsPrecision(Date.now())
  await writeFile(sourceUrl)
  await writeEntryModificationTime(sourceUrl, mtime)

  const actual = toSecondsPrecision(await readEntryModificationTime(sourceUrl))
  const expected = mtime
  assert({ actual, expected })
}
