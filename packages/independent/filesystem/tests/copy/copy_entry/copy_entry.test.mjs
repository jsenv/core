import { assert } from "@jsenv/assert";
import { urlToFileSystemPath, ensurePathnameTrailingSlash } from "@jsenv/urls";

import {
  writeDirectory,
  ensureEmptyDirectory,
  writeFile,
  copyEntry,
  readFile,
  writeEntryPermissions,
  writeEntryModificationTime,
  readEntryPermissions,
  readEntryModificationTime,
  writeSymbolicLink,
  readSymbolicLink,
} from "@jsenv/filesystem";
import {
  testDirectoryPresence,
  testFilePresence,
  toSecondsPrecision,
} from "@jsenv/filesystem/tests/testHelpers.js";

const isWindows = process.platform === "win32";
const tempDirectoryUrl = new URL("./temp/", import.meta.url).href;
await ensureEmptyDirectory(tempDirectoryUrl);

// copy nothing into nothing
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;

  try {
    await copyEntry({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `nothing to copy at ${urlToFileSystemPath(sourceUrl)}`,
    );
    assert({ actual, expect });
  }
}

// copy file into same file
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("source", tempDirectoryUrl).href;
  await writeFile(sourceUrl);

  try {
    await copyEntry({
      from: sourceUrl,
      to: destinationUrl,
      overwrite: true,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot copy ${urlToFileSystemPath(
        sourceUrl,
      )} because destination and source are the same`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// copy file into nothing
{
  const sourceUrl = new URL("source/file", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest/file", tempDirectoryUrl).href;
  const sourceContent = "hello";
  const sourceMtime = toSecondsPrecision(Date.now());
  const sourcePermissions = {
    owner: { read: true, write: false, execute: false },
    group: { read: false, write: false, execute: false },
    others: { read: false, write: false, execute: false },
  };
  await writeFile(sourceUrl, "hello");
  await writeEntryPermissions(sourceUrl, sourcePermissions);
  await writeEntryModificationTime(sourceUrl, sourceMtime);

  await copyEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    sourceContent: await readFile(sourceUrl, { as: "string" }),
    sourceMtime: toSecondsPrecision(await readEntryModificationTime(sourceUrl)),
    destinationContent: await readFile(destinationUrl, { as: "string" }),
    destinationMtime: toSecondsPrecision(
      await readEntryModificationTime(destinationUrl),
    ),
  };
  const expect = {
    sourceContent,
    sourceMtime,
    destinationContent: sourceContent,
    destinationMtime: sourceMtime,
  };
  assert({ actual, expect });
  // on windows permissions are not reliable
  if (!isWindows) {
    const actual = {
      sourcePermissions: await readEntryPermissions(sourceUrl),
      destinationPermissions: await readEntryPermissions(destinationUrl),
    };
    const expect = {
      sourcePermissions: {
        owner: { ...sourcePermissions.owner },
        group: { ...sourcePermissions.group },
        others: { ...sourcePermissions.others },
      },
      destinationPermissions: sourcePermissions,
    };
    assert({ actual, expect });
  }
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy file into file and overwrite disabled
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  await writeFile(sourceUrl);
  await writeFile(destinationUrl);

  try {
    await copyEntry({ from: sourceUrl, to: destinationUrl });
  } catch (actual) {
    const expect = new Error(
      `cannot copy file from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and overwrite option is disabled`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// copy file into file and overwrite enabled
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  await writeFile(sourceUrl, "foo");
  await writeFile(destinationUrl, "bar");

  await copyEntry({
    from: sourceUrl,
    to: destinationUrl,
    overwrite: true,
  });
  const actual = await readFile(destinationUrl, { as: "string" });
  const expect = "foo";
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy file into directory
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  await writeFile(sourceUrl, "foo");
  await writeDirectory(destinationUrl);

  try {
    await copyEntry({
      from: sourceUrl,
      to: destinationUrl,
      overwrite: true,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot copy file from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and is not a file (it's a directory)`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// copy directory into file
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  await writeDirectory(sourceUrl);
  await writeFile(destinationUrl);

  try {
    await copyEntry({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot copy directory from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and is not a directory (it's a file)`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// copy directory into directory and overwrite disabled
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  await writeDirectory(sourceUrl);
  await writeDirectory(destinationUrl);

  try {
    await copyEntry({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot copy directory from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and overwrite option is disabled`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// copy directory into directory and overwrite enabled
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  await writeDirectory(sourceUrl);
  await writeDirectory(destinationUrl);

  await copyEntry({
    from: sourceUrl,
    to: destinationUrl,
    overwrite: true,
  });
  const actual = {
    directoryAtSource: await testDirectoryPresence(sourceUrl),
    directoryAtDestination: await testDirectoryPresence(destinationUrl),
  };
  const expect = {
    directoryAtSource: true,
    directoryAtDestination: true,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy directory with content into nothing
{
  const sourceUrl = new URL("source/", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest/", tempDirectoryUrl).href;
  const fileSourceUrl = new URL("file", sourceUrl).href;
  const fileDestinationUrl = new URL("file", destinationUrl).href;
  await writeDirectory(sourceUrl);
  await writeFile(fileSourceUrl, "foo");

  await copyEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    sourceContent: await readFile(fileSourceUrl, { as: "string" }),
    destinationContent: await readFile(fileDestinationUrl, { as: "string" }),
  };
  const expect = {
    sourceContent: "foo",
    destinationContent: "foo",
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy directory with content into directory with content and overwrite enabled
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  const fileASourceUrl = new URL("source/a.txt", tempDirectoryUrl).href;
  const fileADestinationUrl = new URL("dest/a.txt", tempDirectoryUrl).href;
  const fileBDestinationUrl = new URL("dest/b.txt", tempDirectoryUrl).href;
  await writeDirectory(sourceUrl);
  await writeFile(fileASourceUrl, "sourceA");
  await writeDirectory(destinationUrl);
  await writeFile(fileADestinationUrl, "destinationA");
  await writeFile(fileBDestinationUrl, "destinationB");

  await copyEntry({
    from: sourceUrl,
    to: destinationUrl,
    overwrite: true,
  });
  const actual = {
    fileASourceContent: await readFile(fileASourceUrl, { as: "string" }),
    fileADestinationContent: await readFile(fileADestinationUrl, {
      as: "string",
    }),
    fileBDestinationPresent: await testFilePresence(fileBDestinationUrl),
  };
  const expect = {
    fileASourceContent: "sourceA",
    fileADestinationContent: "sourceA",
    fileBDestinationPresent: false,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy directory with relative link targeting node inside into nothing
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  const linkSourceUrl = new URL("source/link", tempDirectoryUrl).href;
  const linkDestinationUrl = new URL("dest/link", tempDirectoryUrl).href;
  await writeDirectory(sourceUrl);
  await writeSymbolicLink({ from: linkSourceUrl, to: "./whatever" });

  await copyEntry({ from: sourceUrl, to: destinationUrl });
  const actual = await readSymbolicLink(linkDestinationUrl);
  const expect = "./whatever";
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy directory with relative link targeting node outside into nothing
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  const linkSourceUrl = new URL("source/link", tempDirectoryUrl).href;
  const linkDestinationUrl = new URL("dest/link", tempDirectoryUrl).href;
  await writeDirectory(sourceUrl);
  await writeSymbolicLink({ from: linkSourceUrl, to: "../whatever" });

  await copyEntry({ from: sourceUrl, to: destinationUrl });
  const actual = await readSymbolicLink(linkDestinationUrl);
  const expect = "../whatever";
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy directory with absolute link inside into nothing
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  const linkSourceUrl = new URL("source/link", tempDirectoryUrl).href;
  const linkDestinationUrl = new URL("dest/link", tempDirectoryUrl).href;
  const insideSourceUrl = new URL("source/file", tempDirectoryUrl).href;
  const insideDestinationUrl = new URL("dest/file", tempDirectoryUrl).href;
  await writeDirectory(sourceUrl);
  await writeSymbolicLink({ from: linkSourceUrl, to: insideSourceUrl });

  await copyEntry({ from: sourceUrl, to: destinationUrl });
  const actual = await readSymbolicLink(linkDestinationUrl);
  const expect = insideDestinationUrl;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy directory with absolute link absolute link outside into nothing
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  const linkSourceUrl = new URL("source/link", tempDirectoryUrl).href;
  const linkDestinationUrl = new URL("dest/link", tempDirectoryUrl).href;
  await writeDirectory(sourceUrl);
  await writeSymbolicLink({ from: linkSourceUrl, to: tempDirectoryUrl });

  await copyEntry({ from: sourceUrl, to: destinationUrl });
  const actual = ensurePathnameTrailingSlash(
    await readSymbolicLink(linkDestinationUrl),
  );
  const expect = tempDirectoryUrl;
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy link into nothing
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" });

  await copyEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    sourceTarget: await readSymbolicLink(sourceUrl),
    destinationTarget: await readSymbolicLink(destinationUrl),
  };
  const expect = {
    sourceTarget: "./whatever",
    destinationTarget: "./whatever",
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy link to nothing into link to nothing
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  const fileUrl = new URL("desttarget", tempDirectoryUrl).href;
  await writeSymbolicLink({ from: sourceUrl, to: "./sourcetarget" });
  await writeSymbolicLink({ from: destinationUrl, to: "./desttarget" });

  await copyEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    sourceLinkTarget: await readSymbolicLink(sourceUrl),
    destinationLinkTarget: await readSymbolicLink(destinationUrl),
    linkTarget: await readSymbolicLink(fileUrl),
  };
  const expect = {
    sourceLinkTarget: "./sourcetarget",
    destinationLinkTarget: "./desttarget",
    linkTarget: "./sourcetarget",
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy link to nothing into link to nothing with followLink disabled
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" });
  await writeSymbolicLink({ from: destinationUrl, to: "./whatever" });

  try {
    await copyEntry({
      from: sourceUrl,
      to: destinationUrl,
      followLink: false,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot copy symbolic-link from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and overwrite option is disabled`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// copy link to nothing into link to nothing with followLink disabled and overwrite enabled
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  const sourceLinkTarget = "./sourcetarget";
  const destinationLinkTarget = "./destinationtarget";
  await writeSymbolicLink({ from: sourceUrl, to: sourceLinkTarget });
  await writeSymbolicLink({ from: destinationUrl, to: destinationLinkTarget });

  await copyEntry({
    from: sourceUrl,
    to: destinationUrl,
    followLink: false,
    overwrite: true,
  });
  const actual = {
    sourceLinkTarget: await readSymbolicLink(sourceUrl),
    destinationLinkTarget: await readSymbolicLink(destinationUrl),
  };
  const expect = {
    sourceLinkTarget,
    destinationLinkTarget: sourceLinkTarget,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy file into link to nothing
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  const fileUrl = new URL("file", tempDirectoryUrl).href;
  await writeFile(sourceUrl, "foo");
  await writeSymbolicLink({ from: destinationUrl, to: "./file" });

  await copyEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    sourceContent: await readFile(sourceUrl, { as: "string" }),
    destinationLinkTarget: await readSymbolicLink(destinationUrl),
    fileContent: await readFile(fileUrl, { as: "string" }),
  };
  const expect = {
    sourceContent: "foo",
    destinationLinkTarget: "./file",
    fileContent: "foo",
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// copy file into link to same file
{
  const sourceUrl = new URL("source", tempDirectoryUrl).href;
  const destinationUrl = new URL("dest", tempDirectoryUrl).href;
  await writeFile(sourceUrl, "foo");
  await writeSymbolicLink({ from: destinationUrl, to: "./source" });

  try {
    await copyEntry({
      from: sourceUrl,
      to: destinationUrl,
      overwrite: true,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot copy ${urlToFileSystemPath(
        sourceUrl,
      )} because destination and source are the same`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}
