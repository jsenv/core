import { assert } from "@jsenv/assert";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import {
  copyDirectoryContent,
  ensureEmptyDirectorySync,
  readFileStructureSync,
  writeDirectory,
  writeFile,
  writeFileStructureSync,
} from "@jsenv/filesystem";
import { urlToFileSystemPath } from "@jsenv/urls";

const tempDirectoryUrl = new URL("./temp/", import.meta.url);

if (process.platform === "win32") {
  process.exit(0);
  // currently fails due to a trailing slash in file path in error messages
  // TODO: fix this
}

const test = async (callback) => {
  ensureEmptyDirectorySync(tempDirectoryUrl);

  try {
    await callback();
  } finally {
    ensureEmptyDirectorySync(tempDirectoryUrl);
  }
};

// copy nothing into nothing
await test(async () => {
  const sourceUrl = new URL("source/", tempDirectoryUrl);
  const destinationUrl = new URL("dest", tempDirectoryUrl);

  try {
    await copyDirectoryContent({
      from: sourceUrl,
      to: destinationUrl,
    });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `no directory to copy content from at ${urlToFileSystemPath(sourceUrl)}`,
    );
    assert({ actual, expect });
  }
});

// copy file instead of directory
await test(async () => {
  const sourceUrl = new URL("source", tempDirectoryUrl);
  const destinationUrl = new URL("source", tempDirectoryUrl);
  await writeFile(sourceUrl, "coucou");

  try {
    await copyDirectoryContent({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `found a file instead of a directory at ${urlToFileSystemPath(
        sourceUrl,
      )}`,
    );
    assert({ actual, expect });
  }
});

// copy directory into nothing
await test(async () => {
  const sourceUrl = new URL("source", tempDirectoryUrl);
  const destinationUrl = new URL("dest", tempDirectoryUrl);
  await writeDirectory(sourceUrl);

  try {
    await copyDirectoryContent({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `no directory to copy content into at ${urlToFileSystemPath(
        destinationUrl,
      )}`,
    );
    assert({ actual, expect });
  }
});

// move directory into file instead of directory
await test(async () => {
  const sourceUrl = new URL("source", tempDirectoryUrl);
  const destinationUrl = new URL("dest", tempDirectoryUrl);
  await writeDirectory(sourceUrl);
  await writeFile(destinationUrl);

  try {
    await copyDirectoryContent({ from: sourceUrl, to: destinationUrl });
    throw new Error("should throw");
  } catch (actual) {
    const expect = new Error(
      `destination leads to a file instead of a directory at ${urlToFileSystemPath(
        destinationUrl,
      )}`,
    );
    assert({ actual, expect });
  }
});

// copy directory into directory
await test(async () => {
  writeFileStructureSync(tempDirectoryUrl, {
    "source/a.txt": "",
    "into/dest/b.txt": "",
  });
  await copyDirectoryContent({
    from: new URL("source", tempDirectoryUrl),
    to: new URL("into/dest", tempDirectoryUrl),
  });
  const actual = readFileStructureSync(tempDirectoryUrl);
  const expect = {
    "into/dest/a.txt": "",
    "into/dest/b.txt": "",
    "source/a.txt": "",
  };
  assert({ actual, expect });
});
