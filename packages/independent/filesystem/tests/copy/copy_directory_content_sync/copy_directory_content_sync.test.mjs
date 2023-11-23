import { assert } from "@jsenv/assert";
import { urlToFileSystemPath } from "@jsenv/urls";
import { takeDirectorySnapshot, storeSnapshot } from "@jsenv/snapshot";

import {
  copyDirectoryContentSync,
  ensureEmptyDirectorySync,
  writeFileSync,
  writeDirectorySync,
} from "@jsenv/filesystem";
import { testFilePresence } from "@jsenv/filesystem/tests/testHelpers.js";

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
    const expected = new Error(
      `no directory to copy content from at ${urlToFileSystemPath(sourceUrl)}`,
    );
    assert({ actual, expected });
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
    const expected = new Error(
      `found a file instead of a directory at ${urlToFileSystemPath(
        sourceUrl,
      )}`,
    );
    assert({ actual, expected });
    ensureEmptyDirectory(tempDirectoryUrl);
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
    const expected = new Error(
      `no directory to copy content into at ${urlToFileSystemPath(
        destinationUrl,
      )}`,
    );
    assert({ actual, expected });
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
    const expected = new Error(
      `destination leads to a file instead of a directory at ${urlToFileSystemPath(
        destinationUrl,
      )}`,
    );
    assert({ actual, expected });
  }
});

// copy directory into directory
test(() => {
  const sourceUrl = new URL("source", tempDirectoryUrl);
  storeSnapshot(tempDirectoryUrl, {
    "a": "",
    "dest/a": "",
    "dest/b": "",
  });

  copyDirectoryContentSync({
    from: sourceUrl,
    to: tempDirectoryUrl,
  });
  const actual = takeDirectorySnapshot(tempDirectoryUrl);
  const expected = {
    "a": "",
    "dest/a": "",
    "dest/b": "",
  };
  assert({ actual, expected });
});
