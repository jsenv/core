import { assert } from "@jsenv/assert"

import {
  ensureEmptyDirectory,
  writeFile,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)
await ensureEmptyDirectory(tempDirectoryUrl)

{
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl)
  const fileUrl = resolveUrl("file.txt", directoryUrl)
  await writeFile(fileUrl, "hello world")
  const actual = await readFile(fileUrl, { as: "string" })
  const expected = "hello world"
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}
