import { assert } from "@jsenv/assert"

import {
  removeEntry,
  ensureEmptyDirectory,
  writeFile,
  resolveUrl,
  writeDirectory,
  writeEntryPermissions,
  urlToFileSystemPath,
  writeSymbolicLink,
} from "@jsenv/filesystem"
import {
  makeBusyFile,
  testFilePresence,
  testDirectoryPresence,
  testSymbolicLinkPresence,
} from "@jsenv/filesystem/test/testHelpers.js"

const isWindows = process.platform === "win32"
const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)
await ensureEmptyDirectory(tempDirectoryUrl)

// remove nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)

  try {
    await removeEntry(sourceUrl)
  } catch (actual) {
    const expected = new Error(
      `nothing to remove at ${urlToFileSystemPath(sourceUrl)}`,
    )
    assert({ actual, expected })
  }
}

// remove nothing and allowUseless enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)

  const actual = await removeEntry(sourceUrl, { allowUseless: true })
  const expected = undefined
  assert({ actual, expected })
}

// remove opened filed
if (!isWindows) {
  // on windows it woul EPERM
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await makeBusyFile(sourceUrl, async () => {
    await removeEntry(sourceUrl)
    const actual = await testFilePresence(sourceUrl)
    const expected = false
    assert({ actual, expected })
  })
}

// remove file inside a directory without execute permission
if (!isWindows) {
  const sourceUrl = resolveUrl("dir/source", tempDirectoryUrl)
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl)
  await writeDirectory(directoryUrl)
  await writeFile(sourceUrl)
  await writeEntryPermissions(directoryUrl, {
    owner: { read: true, write: true, execute: false },
  })

  try {
    await removeEntry(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `EACCES: permission denied, lstat '${urlToFileSystemPath(sourceUrl)}'`,
    )
    expected.errno = actual.errno
    expected.code = "EACCES"
    expected.syscall = "lstat"
    expected.path = urlToFileSystemPath(sourceUrl)
    assert({ actual, expected })
  } finally {
    await writeEntryPermissions(directoryUrl, {
      owner: { read: true, write: true, execute: true },
    })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// remove file without permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeFile(sourceUrl, "noperm")
  await writeEntryPermissions(sourceUrl, {
    owner: { read: false, write: false, execute: false },
  })

  await removeEntry(sourceUrl)
  const actual = await testFilePresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeFile(sourceUrl, "normal")

  await removeEntry(sourceUrl)
  const actual = await testFilePresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove destination with trailing slash being a file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const sourceUrlWithTrailingSlash = `${sourceUrl}/`
  await writeFile(sourceUrl, "trailing")

  await removeEntry(sourceUrlWithTrailingSlash)
  const actual = await testFilePresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeDirectory(sourceUrl)

  await removeEntry(sourceUrl)
  const actual = await testFilePresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove directory without permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeEntryPermissions(sourceUrl, {
    other: { read: false, write: false, execute: false },
  })

  await removeEntry(sourceUrl)
  const actual = await testFilePresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove directory with a file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeFile(fileUrl)

  try {
    await removeEntry(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `ENOTEMPTY: directory not empty, rmdir '${urlToFileSystemPath(
        sourceUrl,
      )}'`,
    )
    expected.errno = actual.errno
    expected.code = "ENOTEMPTY"
    expected.syscall = "rmdir"
    expected.path = urlToFileSystemPath(sourceUrl)
    assert({ actual, expected })
  } finally {
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// remove directory with a file and recursive enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeFile(fileUrl)

  await removeEntry(sourceUrl, { recursive: true })
  const actual = await testDirectoryPresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove directory with content without permission and recursive enabled
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeFile(fileUrl)
  await writeEntryPermissions(sourceUrl, {
    owner: { read: true, write: true, execute: false },
  })

  try {
    await removeEntry(sourceUrl, { recursive: true })
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `EACCES: permission denied, lstat '${urlToFileSystemPath(fileUrl)}'`,
    )
    expected.errno = -13
    expected.code = "EACCES"
    expected.syscall = "lstat"
    expected.path = urlToFileSystemPath(fileUrl)
    assert({ actual, expected })
  } finally {
    await writeEntryPermissions(sourceUrl, {
      owner: { read: true, write: true, execute: true },
    })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// remove directory with a busy file
if (!isWindows) {
  // on windows it would EPERM
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl)
  await writeDirectory(sourceUrl)

  await makeBusyFile(fileUrl, async () => {
    await removeEntry(sourceUrl, { recursive: true })
    const actual = await testDirectoryPresence(sourceUrl)
    const expected = false
    assert({ actual, expected })
  })
}

// remove directory with a file without write permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl)
  await writeFile(fileUrl)
  await writeEntryPermissions(fileUrl, {
    owner: { read: false, write: false, execute: false },
  })

  await removeEntry(sourceUrl, { recursive: true })
  const actual = await testDirectoryPresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove directory with file nested and recursive enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileAUrl = resolveUrl("source/dir/file", tempDirectoryUrl)
  const fileBUrl = resolveUrl("source/dir2/file", tempDirectoryUrl)
  await writeFile(fileAUrl, "contentA")
  await writeFile(fileBUrl, "contentB")

  await removeEntry(sourceUrl, { recursive: true })
  const actual = await testDirectoryPresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove directory with a link to nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const linkUrl = resolveUrl("source/link", tempDirectoryUrl)
  await writeSymbolicLink({ from: linkUrl, to: "./whatever" })

  await removeEntry(sourceUrl, { recursive: true })
  const actual = await testDirectoryPresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove link to nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" })

  await removeEntry(sourceUrl)
  const actual = await testSymbolicLinkPresence(sourceUrl)
  const expected = false
  assert({ actual, expected })
}

// remove link to file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("file", tempDirectoryUrl)
  await writeFile(fileUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./file" })

  await removeEntry(sourceUrl)
  const actual = {
    linkPresence: await testSymbolicLinkPresence(sourceUrl),
    filePresence: await testFilePresence(fileUrl),
  }
  const expected = {
    linkPresence: false,
    filePresence: true,
  }
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// remove link to directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl)
  await writeDirectory(directoryUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./dir" })

  await removeEntry(sourceUrl)
  const actual = {
    linkPresence: await testSymbolicLinkPresence(sourceUrl),
    directoryPresence: await testDirectoryPresence(directoryUrl),
  }
  const expected = {
    linkPresence: false,
    directoryPresence: true,
  }
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// remove directory without execute permission and link inside
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const linkUrl = resolveUrl("source/link", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeSymbolicLink({ from: linkUrl, to: "whatever" })
  await writeEntryPermissions(sourceUrl, {
    owner: { read: true, write: true, execute: false },
  })

  try {
    await removeEntry(sourceUrl, { recursive: true })
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `EACCES: permission denied, lstat '${urlToFileSystemPath(linkUrl)}'`,
    )
    expected.errno = -13
    expected.code = "EACCES"
    expected.syscall = "lstat"
    expected.path = urlToFileSystemPath(linkUrl)
    assert({ actual, expected })
  } finally {
    await writeEntryPermissions(sourceUrl, {
      owner: { read: true, write: true, execute: true },
    })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}
