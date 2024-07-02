import { assert } from "@jsenv/assert";
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls";

import {
  ensureEmptyDirectory,
  writeDirectory,
  writeFile,
  moveDirectoryContent,
} from "@jsenv/filesystem";
import { testFilePresence } from "@jsenv/filesystem/tests/testHelpers.js";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

// move nothing into nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);

  try {
    await moveDirectoryContent({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `no directory to move content from at ${urlToFileSystemPath(sourceUrl)}`,
    );
    assert({ actual, expect });
  }
}

// move file instead of directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("source", tempDirectoryUrl);
  await writeFile(sourceUrl, "coucou");

  try {
    await moveDirectoryContent({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `found a file instead of a directory at ${urlToFileSystemPath(
        sourceUrl,
      )}`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move directory into nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  await writeDirectory(sourceUrl);

  try {
    await moveDirectoryContent({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `no directory to move content into at ${urlToFileSystemPath(
        destinationUrl,
      )}`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move directory into file instead of directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeFile(destinationUrl);

  try {
    await moveDirectoryContent({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `destination leads to a file instead of a directory at ${urlToFileSystemPath(
        destinationUrl,
      )}`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move directory into directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileASourceUrl = resolveUrl("source/a", tempDirectoryUrl);
  const destinationUrl = resolveUrl("into/dest", tempDirectoryUrl);
  const fileBDestinationUrl = resolveUrl("into/dest/b", tempDirectoryUrl);
  const fileADestinationUrl = resolveUrl("into/dest/a", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeFile(fileASourceUrl);
  await writeDirectory(destinationUrl);
  await writeFile(fileBDestinationUrl);

  await moveDirectoryContent({ from: sourceUrl, to: destinationUrl });

  const actual = {
    fileASourcePresence: await testFilePresence(fileASourceUrl),
    fileADestinationPresence: await testFilePresence(fileADestinationUrl),
    fileBDestinationPresence: await testFilePresence(fileBDestinationUrl),
  };
  const expect = {
    fileASourcePresence: false,
    fileADestinationPresence: true,
    fileBDestinationPresence: true,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}
