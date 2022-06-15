import { assert } from "@jsenv/assert"
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls"

import {
  ensureEmptyDirectory,
  assertFilePresence,
  writeFile,
  writeDirectory,
  writeSymbolicLink,
} from "@jsenv/filesystem"

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)
await ensureEmptyDirectory(tempDirectoryUrl)

// on nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  try {
    await assertFilePresence(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `file not found at ${urlToFileSystemPath(sourceUrl)}`,
    )
    assert({ actual, expected })
  }
}

// on directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeDirectory(sourceUrl)

  try {
    await assertFilePresence(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `file expected at ${urlToFileSystemPath(
        sourceUrl,
      )} and found directory instead`,
    )
    assert({ actual, expected })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// on file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeFile(sourceUrl)

  const actual = await assertFilePresence(sourceUrl)
  const expected = undefined
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// on symlink to nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./file" })

  try {
    await assertFilePresence(sourceUrl)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `file not found at ${urlToFileSystemPath(sourceUrl)}`,
    )
    assert({ actual, expected })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// on symlink to file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileUrl = resolveUrl("file", tempDirectoryUrl)
  await writeFile(fileUrl)
  await writeSymbolicLink({ from: sourceUrl, to: "./file" })

  const actual = await assertFilePresence(sourceUrl)
  const expected = undefined
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}
