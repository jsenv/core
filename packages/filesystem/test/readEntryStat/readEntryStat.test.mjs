import { assert } from "@jsenv/assert"

import {
  ensureEmptyDirectory,
  writeDirectory,
  writeFile,
  resolveUrl,
  readEntryStat,
  writeEntryPermissions,
  writeSymbolicLink,
  urlToFileSystemPath,
} from "@jsenv/filesystem"
import { makeBusyFile } from "@jsenv/filesystem/test/testHelpers.js"

const isWindows = process.platform === "win32"
const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)
await ensureEmptyDirectory(tempDirectoryUrl)

// nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)

  try {
    await readEntryStat(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `ENOENT: no such file or directory, stat '${urlToFileSystemPath(
        sourceUrl,
      )}'`,
    )
    expected.errno = actual.errno
    expected.code = "ENOENT"
    expected.syscall = "stat"
    expected.path = urlToFileSystemPath(sourceUrl)
    assert({ actual, expected })
  }
}

// nothing with nullIfNotFound
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)

  const actual = await readEntryStat(sourceUrl, {
    nullIfNotFound: true,
  })
  const expected = null
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// directory without permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeEntryPermissions(sourceUrl, {
    owner: { read: false, write: false, execute: false },
  })

  const sourceStats = await readEntryStat(sourceUrl)
  const actual = typeof sourceStats
  const expected = "object"
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// file without permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeFile(sourceUrl, "coucou")
  await writeEntryPermissions(sourceUrl, {
    owner: { read: false, write: false, execute: false },
  })

  const sourceStats = await readEntryStat(sourceUrl)
  const actual = typeof sourceStats
  const expected = "object"
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// busy file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await makeBusyFile(sourceUrl, async () => {
    const sourceStats = await readEntryStat(sourceUrl)
    const actual = typeof sourceStats
    const expected = "object"
    assert({ actual, expected })
  })
}

// file inside directory without execute or read permission
if (!isWindows) {
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl)
  const sourceUrl = resolveUrl("source", directoryUrl)
  await writeDirectory(directoryUrl)
  await writeFile(sourceUrl)
  await writeEntryPermissions(directoryUrl, {
    owner: { read: false, write: false, execute: false },
  })

  try {
    await readEntryStat(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `EACCES: permission denied, stat '${urlToFileSystemPath(sourceUrl)}'`,
    )
    expected.errno = actual.errno
    expected.code = "EACCES"
    expected.syscall = "stat"
    expected.path = urlToFileSystemPath(sourceUrl)
    assert({ actual, expected })
  } finally {
    await writeEntryPermissions(directoryUrl, {
      owner: { read: true, execute: true },
    })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeDirectory(sourceUrl)

  const sourceStats = await readEntryStat(sourceUrl)
  const actual = typeof sourceStats
  const expected = "object"
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// normal file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeFile(sourceUrl)

  const sourceStats = await readEntryStat(sourceUrl)
  const actual = typeof sourceStats
  const expected = "object"
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// link to nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" })

  try {
    await readEntryStat(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `ENOENT: no such file or directory, stat '${urlToFileSystemPath(
        sourceUrl,
      )}'`,
    )
    expected.errno = actual.errno
    expected.code = "ENOENT"
    expected.syscall = "stat"
    expected.path = urlToFileSystemPath(sourceUrl)
    assert({ actual, expected })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// link to directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl)
  await writeDirectory(directoryUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./dir" })

  const sourceStats = await readEntryStat(sourceUrl)
  const actual = sourceStats.isDirectory()
  const expected = true
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// link to file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("file", tempDirectoryUrl)
  await writeFile(fileUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./file" })

  const sourceStats = await readEntryStat(sourceUrl)
  const actual = sourceStats.isFile()
  const expected = true
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// link to nothing with followSymlink disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" })

  const sourceStats = await readEntryStat(sourceUrl, {
    followLink: false,
  })
  const actual = sourceStats.isSymbolicLink()
  const expected = true
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// link to directory with followSymlink disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl)
  await writeDirectory(directoryUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./dir" })

  const sourceStats = await readEntryStat(sourceUrl, {
    followLink: false,
  })
  const actual = sourceStats.isSymbolicLink()
  const expected = true
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// link to file with followSymlink disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("file", tempDirectoryUrl)
  await writeFile(fileUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./file" })

  const sourceStats = await readEntryStat(sourceUrl, {
    followLink: false,
  })
  const actual = sourceStats.isSymbolicLink()
  const expected = true
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}
