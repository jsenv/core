import { assert } from "@jsenv/assert";
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls";
import {
  ensureEmptyDirectory,
  assertDirectoryPresence,
  writeFile,
  writeDirectory,
  writeSymbolicLink,
  writeEntryPermissions,
} from "@jsenv/filesystem";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);
await writeEntryPermissions(tempDirectoryUrl, {
  owner: { read: true, write: true, execute: true },
  group: { read: true, write: true, execute: true },
  others: { read: true, write: true, execute: true },
});

// on nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  try {
    await assertDirectoryPresence(sourceUrl);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `directory not found at ${urlToFileSystemPath(sourceUrl)}`,
    );
    assert({ actual, expect });
  }
}

// on file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeFile(sourceUrl);

  try {
    await assertDirectoryPresence(sourceUrl);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `directory expect at ${urlToFileSystemPath(
        sourceUrl,
      )} and found file instead`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// on directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeDirectory(sourceUrl);

  const actual = await assertDirectoryPresence(sourceUrl);
  const expect = undefined;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// on symlink to file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./file" });

  try {
    await assertDirectoryPresence(sourceUrl);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `directory expect at ${urlToFileSystemPath(
        sourceUrl,
      )} and found file instead`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// on symlink to nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./file" });

  try {
    await assertDirectoryPresence(sourceUrl);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `directory not found at ${urlToFileSystemPath(sourceUrl)}`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// on symlink to directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl);
  await writeDirectory(directoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./dir" });

  const actual = await assertDirectoryPresence(sourceUrl);
  const expect = undefined;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}
