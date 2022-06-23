import { assert } from "@jsenv/assert"
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls"

import {
  ensureEmptyDirectory,
  writeDirectory,
  writeFile,
  copyDirectoryContent,
} from "@jsenv/filesystem"
import { testFilePresence } from "@jsenv/filesystem/tests/testHelpers.js"

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)
await ensureEmptyDirectory(tempDirectoryUrl)

// copy nothing into nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl)

  try {
    await copyDirectoryContent({ from: sourceUrl, to: destinationUrl })
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `no directory to copy content from at ${urlToFileSystemPath(sourceUrl)}`,
    )
    assert({ actual, expected })
  }
}

// copy file instead of directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const destinationUrl = resolveUrl("source", tempDirectoryUrl)
  await writeFile(sourceUrl, "coucou")

  try {
    await copyDirectoryContent({ from: sourceUrl, to: destinationUrl })
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `found a file instead of a directory at ${urlToFileSystemPath(
        sourceUrl,
      )}`,
    )
    assert({ actual, expected })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// copy directory into nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl)
  await writeDirectory(sourceUrl)

  try {
    await copyDirectoryContent({ from: sourceUrl, to: destinationUrl })
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `no directory to copy content into at ${urlToFileSystemPath(
        destinationUrl,
      )}`,
    )
    assert({ actual, expected })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// move directory into file instead of directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeFile(destinationUrl)

  try {
    await copyDirectoryContent({ from: sourceUrl, to: destinationUrl })
    throw new Error("should throw")
  } catch (actual) {
    const expected = new Error(
      `destination leads to a file instead of a directory at ${urlToFileSystemPath(
        destinationUrl,
      )}`,
    )
    assert({ actual, expected })
    await ensureEmptyDirectory(tempDirectoryUrl)
  }
}

// copy directory into directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl)
  const fileASourceUrl = resolveUrl("source/a", tempDirectoryUrl)
  const destinationUrl = resolveUrl("into/dest", tempDirectoryUrl)
  const fileBDestinationUrl = resolveUrl("into/dest/b", tempDirectoryUrl)
  const fileADestinationUrl = resolveUrl("into/dest/a", tempDirectoryUrl)
  await writeDirectory(sourceUrl)
  await writeFile(fileASourceUrl)
  await writeDirectory(destinationUrl)
  await writeFile(fileBDestinationUrl)

  await copyDirectoryContent({ from: sourceUrl, to: destinationUrl })

  const actual = {
    fileASourcePresence: await testFilePresence(fileASourceUrl),
    fileADestinationPresence: await testFilePresence(fileADestinationUrl),
    fileBDestinationPresence: await testFilePresence(fileBDestinationUrl),
  }
  const expected = {
    fileASourcePresence: true,
    fileADestinationPresence: true,
    fileBDestinationPresence: true,
  }
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}
