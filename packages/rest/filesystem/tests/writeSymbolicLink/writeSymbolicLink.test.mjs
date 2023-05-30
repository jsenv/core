import { assert } from "@jsenv/assert";
import { resolveUrl } from "@jsenv/urls";

import {
  ensureEmptyDirectory,
  writeFile,
  readFile,
  writeSymbolicLink,
  readSymbolicLink,
} from "@jsenv/filesystem";
import { testFilePresence } from "@jsenv/filesystem/tests/testHelpers.js";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);

// basic behaviour
{
  await ensureEmptyDirectory(tempDirectoryUrl);

  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const fileUrl = resolveUrl("file.txt", directoryUrl);
  const linkUrl = resolveUrl("file.alias", directoryUrl);
  await writeFile(fileUrl, "hello world");
  await writeSymbolicLink({ from: linkUrl, to: fileUrl });

  const readSymbolicLinkReturnValue = await readSymbolicLink(linkUrl);
  const readFileOnLinkReturnValue = await readFile(linkUrl, { as: "string" });
  const actual = {
    readSymbolicLinkReturnValue,
    readFileOnLinkReturnValue,
  };
  const expected = {
    readSymbolicLinkReturnValue: fileUrl,
    readFileOnLinkReturnValue: "hello world",
  };
  assert({ actual, expected });
}

// directories
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const fileUrl = resolveUrl("dir/file.txt", tempDirectoryUrl);
  const linkUrl = resolveUrl("link", tempDirectoryUrl);
  const fileFacadeUrl = resolveUrl("link/file.txt", tempDirectoryUrl);

  await writeFile(fileUrl, "hello");
  const presentBeforeLink = await testFilePresence(fileFacadeUrl);
  await writeSymbolicLink({ from: linkUrl, to: directoryUrl });
  const presentAfterLink = await testFilePresence(fileFacadeUrl);
  const actual = {
    presentBeforeLink,
    presentAfterLink,
  };
  const expected = {
    presentBeforeLink: false,
    presentAfterLink: true,
  };
  assert({ actual, expected });
}

// preserves relative notation
{
  await ensureEmptyDirectory(tempDirectoryUrl);

  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const fileUrl = resolveUrl("file.txt", directoryUrl);
  const linkUrl = resolveUrl("file.alias", directoryUrl);
  await writeFile(fileUrl, "hello world");
  await writeSymbolicLink({ from: linkUrl, to: "./file.txt" });

  const readSymbolicLinkReturnValue = await readSymbolicLink(linkUrl);
  const readFileOnLinkReturnValue = await readFile(linkUrl, { as: "string" });
  const actual = {
    readSymbolicLinkReturnValue,
    readFileOnLinkReturnValue,
  };
  const expected = {
    readSymbolicLinkReturnValue: "./file.txt",
    readFileOnLinkReturnValue: "hello world",
  };
  assert({ actual, expected });
}

// link already exists
{
  // arrange
  await ensureEmptyDirectory(tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const fileUrl = resolveUrl("file.txt", directoryUrl);
  const linkUrl = resolveUrl("file.alias", directoryUrl);
  await writeFile(fileUrl, "hello world");
  await writeSymbolicLink({ from: linkUrl, to: fileUrl });

  try {
    // act
    await writeSymbolicLink({ from: linkUrl, to: fileUrl });
    throw new Error("should throw");
  } catch (e) {
    // assert
    const actual = { code: e.code };
    const expected = { code: "EEXIST" };
    assert({ actual, expected });
  }
}

// link already exist + allowUseless
{
  // arrange
  await ensureEmptyDirectory(tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const fileUrl = resolveUrl("file.txt", directoryUrl);
  const linkUrl = resolveUrl("file.alias", directoryUrl);
  await writeFile(fileUrl, "hello world");
  await writeSymbolicLink({ from: linkUrl, to: fileUrl });
  // act
  await writeSymbolicLink({ from: linkUrl, to: fileUrl, allowUseless: true });
  // assert
  const readSymbolicLinkReturnValue = await readSymbolicLink(linkUrl);
  const readFileOnLinkReturnValue = await readFile(linkUrl, { as: "string" });
  const actual = {
    readSymbolicLinkReturnValue,
    readFileOnLinkReturnValue,
  };
  const expected = {
    readSymbolicLinkReturnValue: fileUrl,
    readFileOnLinkReturnValue: "hello world",
  };
  assert({ actual, expected });
}

// link already exists to an other dest + allowUseless
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const fileUrl = resolveUrl("file.txt", directoryUrl);
  const otherFileUrl = resolveUrl("otherfile.txt", directoryUrl);
  const linkUrl = resolveUrl("file.alias", directoryUrl);
  await writeFile(fileUrl, "hello world");
  await writeFile(otherFileUrl, "second");
  await writeSymbolicLink({ from: linkUrl, to: otherFileUrl });

  try {
    await writeSymbolicLink({ from: linkUrl, to: fileUrl, allowUseless: true });
    throw new Error("should throw");
  } catch (e) {
    const actual = { code: e.code };
    const expected = { code: "EEXIST" };
    assert({ actual, expected });
  }
}

// link already exists to an other dest + allowOverwrite
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const fileUrl = resolveUrl("file.txt", directoryUrl);
  const otherFileUrl = resolveUrl("otherfile.txt", directoryUrl);
  const linkUrl = resolveUrl("file.alias", directoryUrl);
  await writeFile(fileUrl, "hello world");
  await writeFile(otherFileUrl, "second");
  await writeSymbolicLink({ from: linkUrl, to: otherFileUrl });

  await writeSymbolicLink({ from: linkUrl, to: fileUrl, allowOverwrite: true });
  const readSymbolicLinkReturnValue = await readSymbolicLink(linkUrl);
  const readFileOnLinkReturnValue = await readFile(linkUrl, { as: "string" });
  const actual = {
    readSymbolicLinkReturnValue,
    readFileOnLinkReturnValue,
  };
  const expected = {
    readSymbolicLinkReturnValue: fileUrl,
    readFileOnLinkReturnValue: "hello world",
  };
  assert({ actual, expected });
}
