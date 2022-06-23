import { assert } from "@jsenv/assert"
import { urlToFileSystemPath, resolveUrl } from "@jsenv/urls"

import {
  ensureEmptyDirectory,
  writeDirectory,
  writeFile,
  readDirectory,
  writeSymbolicLink,
  writeEntryPermissions,
  readEntryPermissions,
} from "@jsenv/filesystem"

const isWindows = process.platform === "win32"
const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)
await ensureEmptyDirectory(tempDirectoryUrl)

// on nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)

  await ensureEmptyDirectory(sourceUrl)
  const actual = await readDirectory(sourceUrl)
  const expected = []
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// on directory with a file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeFile(fileUrl)

  await ensureEmptyDirectory(sourceUrl)
  const actual = await readDirectory(sourceUrl)
  const expected = []
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// on file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeFile(sourceUrl)

  try {
    await ensureEmptyDirectory(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `ensureEmptyDirectory expect directory at ${urlToFileSystemPath(
        sourceUrl,
      )}, found file instead`,
    )
    assert({ actual, expected })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// on symlink to directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl)
  await writeDirectory(directoryUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./dir" })

  try {
    await ensureEmptyDirectory(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `ensureEmptyDirectory expect directory at ${urlToFileSystemPath(
        sourceUrl,
      )}, found symbolic-link instead`,
    )
    assert({ actual, expected })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// a file with an hash inside
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("source/file#toto", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeFile(fileUrl)

  await ensureEmptyDirectory(sourceUrl)
  const actual = await readDirectory(sourceUrl)
  const expected = []
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// directory permissions preserved (mtime cannot when there is a file inside)
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl)
  const permissions = {
    owner: { read: true, write: true, execute: true },
    group: { read: false, write: false, execute: true },
    others: { read: false, write: false, execute: false },
  }
  await writeDirectory(sourceUrl)
  await writeFile(fileUrl)
  await writeEntryPermissions(sourceUrl, permissions)

  await ensureEmptyDirectory(sourceUrl)
  const permissionsAfter = await readEntryPermissions(sourceUrl)
  const actual = permissionsAfter
  const expected = permissions
  assert({ actual, expected })
}
