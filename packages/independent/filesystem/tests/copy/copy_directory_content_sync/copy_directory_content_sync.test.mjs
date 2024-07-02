import { assert } from "@jsenv/assert";
import { urlToFileSystemPath } from "@jsenv/urls";

import {
  copyDirectoryContentSync,
  ensureEmptyDirectorySync,
  writeFileSync,
  writeDirectorySync,
  readFileStructureSync,
  writeFileStructureSync,
} from "@jsenv/filesystem";

const tempDirectoryUrl = new URL("./temp/", import.meta.url);
const test = (callback) => {
  ensureEmptyDirectorySync(tempDirectoryUrl);
  try {
    callback();
  } finally {
    ensureEmptyDirectorySync(tempDirectoryUrl);
  }
};

// copy nothing into nothing
test(() => {
  const sourceUrl = new URL("source", tempDirectoryUrl);
  const destinationUrl = new URL("dest", tempDirectoryUrl);

  try {
    copyDirectoryContentSync({
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
test(() => {
  const sourceUrl = new URL("source", tempDirectoryUrl);
  const destinationUrl = new URL("source", tempDirectoryUrl);
  writeFileSync(sourceUrl, "coucou");

  try {
    copyDirectoryContentSync({
      from: sourceUrl,
      to: destinationUrl,
    });
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
test(() => {
  const sourceUrl = new URL("source", tempDirectoryUrl);
  const destinationUrl = new URL("dest", tempDirectoryUrl);
  writeDirectorySync(sourceUrl);

  try {
    copyDirectoryContentSync({
      from: sourceUrl,
      to: destinationUrl,
    });
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
test(() => {
  const sourceUrl = new URL("source", tempDirectoryUrl);
  const destinationUrl = new URL("dest", tempDirectoryUrl);
  writeDirectorySync(sourceUrl);
  writeFileSync(destinationUrl);

  try {
    copyDirectoryContentSync({
      from: sourceUrl,
      to: destinationUrl,
    });
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
test(() => {
  writeFileStructureSync(tempDirectoryUrl, {
    "source/a.txt": "",
    "into/dest/b.txt": "",
  });
  copyDirectoryContentSync({
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
