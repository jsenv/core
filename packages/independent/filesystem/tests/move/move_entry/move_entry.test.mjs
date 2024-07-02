import { assert } from "@jsenv/assert";
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls";

import {
  ensureEmptyDirectory,
  writeDirectory,
  writeFile,
  moveEntry,
  readFile,
  readSymbolicLink,
  writeSymbolicLink,
} from "@jsenv/filesystem";
import {
  testFilePresence,
  testSymbolicLinkPresence,
  testDirectoryPresence,
} from "@jsenv/filesystem/tests/testHelpers.js";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

// move nothing into nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);

  try {
    await moveEntry({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `nothing to move from ${urlToFileSystemPath(sourceUrl)}`,
    );
    assert({ actual, expect });
  }
}

// move file into same destination
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("source", tempDirectoryUrl);
  await writeFile(sourceUrl, "coucou");

  try {
    await moveEntry({
      from: sourceUrl,
      to: destinationUrl,
      overwrite: true,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `no move needed for ${urlToFileSystemPath(
        sourceUrl,
      )} because destination and source are the same`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move file into link to same destination
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  await writeFile(sourceUrl);
  await writeSymbolicLink({ from: destinationUrl, to: "./source" });

  try {
    await moveEntry({
      from: sourceUrl,
      to: destinationUrl,
      overwrite: true,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `no move needed for ${urlToFileSystemPath(
        sourceUrl,
      )} because destination and source are the same`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move file into nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  await writeFile(sourceUrl, "foo");

  await moveEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    sourcePresence: await testFilePresence(sourceUrl),
    destinationContent: await readFile(destinationUrl, { as: "string" }),
  };
  const expect = {
    sourcePresence: false,
    destinationContent: "foo",
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// move file into link to nothing (link must become effective)
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(sourceUrl, "foo");
  await writeSymbolicLink({ from: destinationUrl, to: "./file" });

  await moveEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    fileAtSource: await testFilePresence(sourceUrl),
    fileContent: await readFile(fileUrl, { as: "string" }),
    destinationContent: await readFile(destinationUrl, { as: "string" }),
  };
  const expect = {
    fileAtSource: false,
    fileContent: "foo",
    destinationContent: "foo",
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// move file into file and overwrite disabled
{
  const sourceUrl = resolveUrl("file", tempDirectoryUrl);
  const destinationUrl = resolveUrl("file2", tempDirectoryUrl);
  await writeFile(sourceUrl);
  await writeFile(destinationUrl);
  try {
    await moveEntry({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot move file from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and overwrite option is disabled`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move file into link to file and overwrite disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  const fileUrl = resolveUrl("whatever", tempDirectoryUrl);
  await writeFile(sourceUrl, "content");
  await writeFile(fileUrl, "original");
  await writeSymbolicLink({ from: destinationUrl, to: "./whatever" });

  try {
    await moveEntry({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot move file from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        fileUrl,
      )} because destination exists and overwrite option is disabled`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move file into link to file and overwrite enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(sourceUrl, "content");
  await writeFile(fileUrl, "original");
  await writeSymbolicLink({ from: destinationUrl, to: "./file" });

  await moveEntry({
    from: sourceUrl,
    to: destinationUrl,
    overwrite: true,
  });
  const actual = {
    sourceFilePresence: await testFilePresence(sourceUrl),
    linkPresence: await testSymbolicLinkPresence(destinationUrl),
    fileContent: await readFile(fileUrl, { as: "string" }),
  };
  const expect = {
    sourceFilePresence: false,
    linkPresence: true,
    fileContent: "content",
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// move file into directory and overwrite enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  await writeFile(sourceUrl);
  await writeDirectory(destinationUrl);

  try {
    await moveEntry({
      from: sourceUrl,
      to: destinationUrl,
      overwrite: true,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot move file from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and is not a file (it's a directory)`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move file into link to directory and overwrite enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl);
  await writeFile(sourceUrl);
  await writeSymbolicLink({ from: destinationUrl, to: "./dir" });
  await writeDirectory(directoryUrl);

  try {
    await moveEntry({
      from: sourceUrl,
      to: destinationUrl,
      overwrite: true,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot move file from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        directoryUrl,
      )} because destination exists and is not a file (it's a directory)`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move file into file and overwrite enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  const sourceContent = "foo";
  await writeFile(sourceUrl, sourceContent);
  await writeFile(destinationUrl, "bar");

  await moveEntry({
    from: sourceUrl,
    to: destinationUrl,
    overwrite: true,
  });
  const actual = {
    sourceFilePresence: await testFilePresence(sourceUrl),
    destinationContent: await readFile(destinationUrl, { as: "string" }),
  };
  const expect = {
    sourceFilePresence: false,
    destinationContent: sourceContent,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// move directory into nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("into/dest", tempDirectoryUrl);
  await writeDirectory(sourceUrl);

  await moveEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    directoryAtSource: await testDirectoryPresence(sourceUrl),
    directoryAtDestination: await testDirectoryPresence(destinationUrl),
  };
  const expect = {
    directoryAtSource: false,
    directoryAtDestination: true,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// move directory into directory and overwrite disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("into/dest", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeDirectory(destinationUrl);

  try {
    await moveEntry({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot move directory from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and overwrite option is disabled`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move directory into link to directory and overwrite disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeDirectory(directoryUrl);
  await writeSymbolicLink({ from: destinationUrl, to: "./dir" });

  try {
    await moveEntry({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot move directory from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        directoryUrl,
      )} because destination exists and overwrite option is disabled`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move directory into file and overwrite enabled
{
  const sourceUrl = resolveUrl("dir", tempDirectoryUrl);
  const destinationUrl = resolveUrl("into/new-name", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeFile(destinationUrl);
  try {
    await moveEntry({
      from: sourceUrl,
      to: destinationUrl,
      overwrite: true,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot move directory from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and is not a directory (it's a file)`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move directory and content into directory and overwrite enabled
{
  const sourceUrl = resolveUrl("dir/", tempDirectoryUrl);
  const destinationUrl = resolveUrl("into/new-name/", tempDirectoryUrl);
  const fileASourceUrl = resolveUrl("filea", sourceUrl);
  const fileADestinationUrl = resolveUrl("filea", destinationUrl);
  const fileBDestinationUrl = resolveUrl("fileb", destinationUrl);
  await writeDirectory(sourceUrl);
  await writeFile(fileASourceUrl, "sourceA");
  await writeDirectory(destinationUrl);
  await writeFile(fileADestinationUrl, "destinationA");
  await writeFile(fileBDestinationUrl, "destinationB");

  await moveEntry({
    from: sourceUrl,
    to: destinationUrl,
    overwrite: true,
  });
  const actual = {
    fileASourcePresence: await testFilePresence(fileASourceUrl),
    fileADestinationContent: await readFile(fileADestinationUrl, {
      as: "string",
    }),
    fileBDestinationPresence: await testFilePresence(fileBDestinationUrl),
  };
  const expect = {
    fileASourcePresence: false,
    fileADestinationContent: "sourceA",
    fileBDestinationPresence: false,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// move link to nothing into nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" });

  await moveEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    linkAtSource: await testSymbolicLinkPresence(sourceUrl),
    destinationLinkTarget: await readSymbolicLink(destinationUrl),
  };
  const expect = {
    linkAtSource: false,
    destinationLinkTarget: "./whatever",
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// move link to nothing into link to nothing
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  const fileUrl = resolveUrl("desttarget", tempDirectoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./sourcetarget" });
  await writeSymbolicLink({ from: destinationUrl, to: "./desttarget" });

  await moveEntry({ from: sourceUrl, to: destinationUrl });
  const actual = {
    sourceLinkPresence: await testSymbolicLinkPresence(sourceUrl),
    destinationLinkTarget: await readSymbolicLink(destinationUrl),
    linkTarget: await readSymbolicLink(fileUrl),
  };
  const expect = {
    sourceLinkPresence: false,
    destinationLinkTarget: "./desttarget",
    linkTarget: "./sourcetarget",
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// move link to nothing into link to nothing with followLink disabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" });
  await writeSymbolicLink({ from: destinationUrl, to: "./whatever" });

  try {
    await moveEntry({
      from: sourceUrl,
      to: destinationUrl,
      followLink: false,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `cannot move symbolic-link from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and overwrite option is disabled`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}

// move link to nothing into link to nothing with followLink disabled and overwrite enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  const sourceTarget = "./sourcetarget";
  const destinationTarget = "./destinationtarget";
  await writeSymbolicLink({ from: sourceUrl, to: sourceTarget });
  await writeSymbolicLink({ from: destinationUrl, to: destinationTarget });

  await moveEntry({
    from: sourceUrl,
    to: destinationUrl,
    followLink: false,
    overwrite: true,
  });
  const actual = {
    sourceLinkPresence: await testSymbolicLinkPresence(sourceUrl),
    destinationLinkTarget: await readSymbolicLink(destinationUrl),
  };
  const expect = {
    sourceLinkPresence: false,
    destinationLinkTarget: sourceTarget,
  };
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// move link to nothing into file and overwrite enabled
{
  const sourceUrl = resolveUrl("source", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dest", tempDirectoryUrl);
  await writeSymbolicLink({ from: sourceUrl, to: "./whatever" });
  await writeFile(destinationUrl);

  try {
    await moveEntry({
      from: sourceUrl,
      to: destinationUrl,
      overwrite: true,
    });
  } catch (actual) {
    const expect = new Error(
      `cannot move symbolic-link from ${urlToFileSystemPath(
        sourceUrl,
      )} to ${urlToFileSystemPath(
        destinationUrl,
      )} because destination exists and is not a symbolic-link (it's a file)`,
    );
    assert({ actual, expect });
    await ensureEmptyDirectory(tempDirectoryUrl);
  }
}
