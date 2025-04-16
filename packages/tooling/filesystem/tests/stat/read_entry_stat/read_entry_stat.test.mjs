import { assert } from "@jsenv/assert";
import {
  ensureEmptyDirectory,
  readEntryStat,
  readEntryStatSync,
  writeDirectory,
  writeEntryPermissions,
  writeFile,
  writeSymbolicLink,
} from "@jsenv/filesystem";
import { makeBusyFile } from "@jsenv/filesystem/tests/testHelpers.js";
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls";

const isWindows = process.platform === "win32";
const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

{
  const url = import.meta.resolve("./fixtures/#.txt");
  const stat = readEntryStatSync(url);
  const actual = stat.isDirectory();
  const expect = false;
  assert({ actual, expect });
}

// nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);

  try {
    await readEntryStat(sourceUrl);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `ENOENT: no such file or directory, stat '${urlToFileSystemPath(
        sourceUrl,
      )}'`,
    );
    expect.errno = actual.errno;
    expect.code = "ENOENT";
    expect.syscall = "stat";
    expect.path = urlToFileSystemPath(sourceUrl);
    assert({ actual, expect });
  }
}

// nothing with nullIfNotFound
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);

  const actual = await readEntryStat(sourceUrl, {
    nullIfNotFound: true,
  });
  const expect = null;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// directory without permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeEntryPermissions(sourceUrl, {
    owner: { read: false, write: false, execute: false },
  });

  const sourceStats = await readEntryStat(sourceUrl);
  const actual = typeof sourceStats;
  const expect = "object";
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// file without permission
if (!isWindows) {
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeFile(sourceUrl, "coucou");
  await writeEntryPermissions(sourceUrl, {
    owner: { read: false, write: false, execute: false },
  });

  const sourceStats = await readEntryStat(sourceUrl);
  const actual = typeof sourceStats;
  const expect = "object";
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// busy file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await makeBusyFile(sourceUrl, async () => {
    const sourceStats = await readEntryStat(sourceUrl);
    const actual = typeof sourceStats;
    const expect = "object";
    assert({ actual, expect });
  });
}

// file inside directory without execute or read permission
if (!isWindows) {
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const sourceUrl = resolveUrl("source", directoryUrl);
  await writeDirectory(directoryUrl);
  await writeFile(sourceUrl);
  await writeEntryPermissions(directoryUrl, {
    owner: { read: false, write: false, execute: false },
  });

  try {
    await readEntryStat(sourceUrl);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `EACCES: permission denied, stat '${urlToFileSystemPath(sourceUrl)}'`,
    );
    expect.errno = actual.errno;
    expect.code = "EACCES";
    expect.syscall = "stat";
    expect.path = urlToFileSystemPath(sourceUrl);
    assert({ actual, expect });
  } finally {
    await writeEntryPermissions(directoryUrl, {
      owner: { read: true, execute: true },
    });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeDirectory(sourceUrl);

  const sourceStats = await readEntryStat(sourceUrl);
  const actual = typeof sourceStats;
  const expect = "object";
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// normal file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeFile(sourceUrl);

  const sourceStats = await readEntryStat(sourceUrl);
  const actual = typeof sourceStats;
  const expect = "object";
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// link to nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" });

  try {
    await readEntryStat(sourceUrl);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `ENOENT: no such file or directory, stat '${urlToFileSystemPath(
        sourceUrl,
      )}'`,
    );
    expect.errno = actual.errno;
    expect.code = "ENOENT";
    expect.syscall = "stat";
    expect.path = urlToFileSystemPath(sourceUrl);
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// link to directory
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  await writeDirectory(directoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./dir" });

  const sourceStats = await readEntryStat(sourceUrl);
  const actual = sourceStats.isDirectory();
  const expect = true;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// link to file
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./file" });

  const sourceStats = await readEntryStat(sourceUrl);
  const actual = sourceStats.isFile();
  const expect = true;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// link to nothing with followSymlink disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" });

  const sourceStats = await readEntryStat(sourceUrl, {
    followLink: false,
  });
  const actual = sourceStats.isSymbolicLink();
  const expect = true;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// link to directory with followSymlink disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  await writeDirectory(directoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./dir" });

  const sourceStats = await readEntryStat(sourceUrl, {
    followLink: false,
  });
  const actual = sourceStats.isSymbolicLink();
  const expect = true;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// link to file with followSymlink disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./file" });

  const sourceStats = await readEntryStat(sourceUrl, {
    followLink: false,
  });
  const actual = sourceStats.isSymbolicLink();
  const expect = true;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}
