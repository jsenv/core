import { assert } from "@jsenv/assert";
import {
  removeEntrySync,
  writeDirectorySync,
  writeFileSync,
} from "@jsenv/filesystem";

import { takeFileSnapshot } from "@jsenv/snapshot";

const fileUrl = new URL("./snapshots/file.txt", import.meta.url);

const test = (callback) => {
  removeEntrySync(fileUrl, { allowUseless: true });
  try {
    callback();
  } finally {
    removeEntrySync(fileUrl, { allowUseless: true });
  }
};

// file url leads to a directory
test(() => {
  writeDirectorySync(fileUrl);
  try {
    takeFileSnapshot(fileUrl);
    throw new Error("should throw");
  } catch (e) {
    const actual = e.message;
    const expected = `file expected at ${fileUrl}`;
    assert({ actual, expected });
  }
});

// snapshot never stored on filesystem + nothing written
test(() => {
  const fileSnapshot = takeFileSnapshot(fileUrl);
  try {
    fileSnapshot.compare();
    throw new Error("should throw");
  } catch (e) {
    const actual = e.message;
    const expected = `snapshot comparison failed for "file.txt"
--- reason ---
file not found
--- file ---
${fileUrl}`;
    assert({ actual, expected });
  }
});

// snapshot exists on filesystem + nothing written
test(() => {
  writeFileSync(fileUrl, "hello");
  const fileSnapshot = takeFileSnapshot(fileUrl);
  try {
    fileSnapshot.compare();
    throw new Error("should throw");
  } catch (e) {
    const actual = e.message;
    const expected = `snapshot comparison failed for "file.txt"
--- reason ---
file not found
--- file ---
${fileUrl}`;
    assert({ actual, expected });
  }
});

// snapshot exists on filesystem + content has changed
test(() => {
  writeFileSync(fileUrl, "hello");
  const fileSnapshot = takeFileSnapshot(fileUrl);
  writeFileSync(fileUrl, "coucou");
  try {
    fileSnapshot.compare();
    throw new Error("should throw");
  } catch (e) {
    const actual = e.message;
    const expected = `snapshot comparison failed for "file.txt"
--- reason ---
unexpected character in file content
--- details ---
coucou
^ unexpected "c", expected to continue with "hello"
--- path ---
[0]
--- file ---
${fileUrl}`;
    assert({ actual, expected });
  }
});

// snapshots exists on filesystem + content is the same
test(() => {
  writeFileSync(fileUrl, "hello");
  const fileSnapshot = takeFileSnapshot(fileUrl);
  writeFileSync(fileUrl, "hello");
  fileSnapshot.compare();
});

// snapshot never stored on filesystem + empty file is written
test(() => {
  const fileSnapshot = takeFileSnapshot(fileUrl);
  writeFileSync(fileUrl, "");
  fileSnapshot.compare();
});

// snapshot exists on filesystem + comparing empty files
test(() => {
  writeFileSync(fileUrl, "");
  const fileSnapshot = takeFileSnapshot(fileUrl);
  writeFileSync(fileUrl, "");
  fileSnapshot.compare();
});
