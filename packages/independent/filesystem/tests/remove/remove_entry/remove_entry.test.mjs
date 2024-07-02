import { assert } from "@jsenv/assert";
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls";

import {
  removeEntry,
  ensureEmptyDirectory,
  writeFile,
  writeDirectory,
  writeEntryPermissions,
  writeSymbolicLink,
} from "@jsenv/filesystem";
import {
  makeBusyFile,
  testFilePresence,
  testDirectoryPresence,
  testSymbolicLinkPresence,
} from "@jsenv/filesystem/tests/testHelpers.js";

const isWindows = process.platform === "win32";
const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

// remove nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);

  try {
    await removeEntry(sourceUrl);
  } catch (actual) {
    const expect = new Error(
      `nothing to remove at ${urlToFileSystemPath(sourceUrl)}`,
    );
    assert({ actual, expect });
  }
}

// remove nothing and allowUseless enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);

  const actual = await removeEntry(sourceUrl, { allowUseless: true });
  const expect = undefined;
  assert({ actual, expect });
}

// remove opened filed
if (!isWindows) {
  // on windows it woul EPERM
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await makeBusyFile(sourceUrl, async () => {
    await removeEntry(sourceUrl);
    const actual = await testFilePresence(sourceUrl);
    const expect = false;
    assert({ actual, expect });
  });
}

// remove file inside a directory without execute permission
if (!isWindows) {
  const sourceUrl = resolveUrl("dir/source", tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl);
  await writeDirectory(directoryUrl);
  await writeFile(sourceUrl);
  await writeEntryPermissions(directoryUrl, {
    owner: { read: true, write: true, execute: false },
  });

  try {
    await removeEntry(sourceUrl);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `EACCES: permission denied, lstat '${urlToFileSystemPath(sourceUrl)}'`,
    );
    expect.errno = actual.errno;
    expect.code = "EACCES";
    expect.syscall = "lstat";
    expect.path = urlToFileSystemPath(sourceUrl);
    assert({ actual, expect });
  } finally {
    await writeEntryPermissions(directoryUrl, {
      owner: { read: true, write: true, execute: true },
    });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// remove file without permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeFile(sourceUrl, "noperm");
  await writeEntryPermissions(sourceUrl, {
    owner: { read: false, write: false, execute: false },
  });

  await removeEntry(sourceUrl);
  const actual = await testFilePresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeFile(sourceUrl, "normal");

  await removeEntry(sourceUrl);
  const actual = await testFilePresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove destination with trailing slash being a file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const sourceUrlWithTrailingSlash = `${sourceUrl}/`;
  await writeFile(sourceUrl, "trailing");

  await removeEntry(sourceUrlWithTrailingSlash);
  const actual = await testFilePresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeDirectory(sourceUrl);

  await removeEntry(sourceUrl);
  const actual = await testFilePresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove directory without permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeEntryPermissions(sourceUrl, {
    other: { read: false, write: false, execute: false },
  });

  await removeEntry(sourceUrl);
  const actual = await testFilePresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove directory with a file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeFile(fileUrl);

  try {
    await removeEntry(sourceUrl);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `ENOTEMPTY: directory not empty, rmdir '${urlToFileSystemPath(
        sourceUrl,
      )}'`,
    );
    expect.errno = actual.errno;
    expect.code = "ENOTEMPTY";
    expect.syscall = "rmdir";
    expect.path = urlToFileSystemPath(sourceUrl);
    assert({ actual, expect });
  } finally {
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// remove directory with a file and recursive enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeFile(fileUrl);

  await removeEntry(sourceUrl, { recursive: true });
  const actual = await testDirectoryPresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove directory with content without permission and recursive enabled
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeFile(fileUrl);
  await writeEntryPermissions(sourceUrl, {
    owner: { read: true, write: true, execute: false },
  });

  try {
    await removeEntry(sourceUrl, { recursive: true });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `EACCES: permission denied, lstat '${urlToFileSystemPath(fileUrl)}'`,
    );
    expect.errno = -13;
    expect.code = "EACCES";
    expect.syscall = "lstat";
    expect.path = urlToFileSystemPath(fileUrl);
    assert({ actual, expect });
  } finally {
    await writeEntryPermissions(sourceUrl, {
      owner: { read: true, write: true, execute: true },
    });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// remove directory with a busy file
if (!isWindows) {
  // on windows it would EPERM
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl);
  await writeDirectory(sourceUrl);

  await makeBusyFile(fileUrl, async () => {
    await removeEntry(sourceUrl, { recursive: true });
    const actual = await testDirectoryPresence(sourceUrl);
    const expect = false;
    assert({ actual, expect });
  });
}

// remove directory with a file without write permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileUrl = resolveUrl("source/file", tempDirectoryUrl);
  await writeFile(fileUrl);
  await writeEntryPermissions(fileUrl, {
    owner: { read: false, write: false, execute: false },
  });

  await removeEntry(sourceUrl, { recursive: true });
  const actual = await testDirectoryPresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove directory with file nested and recursive enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileAUrl = resolveUrl("source/dir/file", tempDirectoryUrl);
  const fileBUrl = resolveUrl("source/dir2/file", tempDirectoryUrl);
  await writeFile(fileAUrl, "contentA");
  await writeFile(fileBUrl, "contentB");

  await removeEntry(sourceUrl, { recursive: true });
  const actual = await testDirectoryPresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove directory with a link to nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const linkUrl = resolveUrl("source/link", tempDirectoryUrl);
  await writeSymbolicLink({ from: linkUrl, to: "./whatever" });

  await removeEntry(sourceUrl, { recursive: true });
  const actual = await testDirectoryPresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove link to nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" });

  await removeEntry(sourceUrl);
  const actual = await testSymbolicLinkPresence(sourceUrl);
  const expect = false;
  assert({ actual, expect });
}

// remove link to file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./file" });

  await removeEntry(sourceUrl);
  const actual = {
    linkPresence: await testSymbolicLinkPresence(sourceUrl),
    filePresence: await testFilePresence(fileUrl),
  };
  const expect = {
    linkPresence: false,
    filePresence: true,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// remove link to directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl);
  await writeDirectory(directoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./dir" });

  await removeEntry(sourceUrl);
  const actual = {
    linkPresence: await testSymbolicLinkPresence(sourceUrl),
    directoryPresence: await testDirectoryPresence(directoryUrl),
  };
  const expect = {
    linkPresence: false,
    directoryPresence: true,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// remove directory without execute permission and link inside
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const linkUrl = resolveUrl("source/link", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeSymbolicLink({ from: linkUrl, to: "whatever" });
  await writeEntryPermissions(sourceUrl, {
    owner: { read: true, write: true, execute: false },
  });

  try {
    await removeEntry(sourceUrl, { recursive: true });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `EACCES: permission denied, lstat '${urlToFileSystemPath(linkUrl)}'`,
    );
    expect.errno = -13;
    expect.code = "EACCES";
    expect.syscall = "lstat";
    expect.path = urlToFileSystemPath(linkUrl);
    assert({ actual, expect });
  } finally {
    await writeEntryPermissions(sourceUrl, {
      owner: { read: true, write: true, execute: true },
    });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}
