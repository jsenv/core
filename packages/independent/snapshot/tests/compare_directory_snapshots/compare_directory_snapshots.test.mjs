import { assert } from "@jsenv/assert";
import {
  ensureEmptyDirectorySync,
  removeDirectorySync,
  copyDirectorySync,
  writeFileSync,
  readFileStructureSync,
} from "@jsenv/filesystem";

import { takeDirectorySnapshot } from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const test = (callback) => {
  ensureEmptyDirectorySync(snapshotsDirectoryUrl);
  try {
    callback();
  } finally {
    ensureEmptyDirectorySync(snapshotsDirectoryUrl);
  }
};

// snapshot directory url leads to a file
test(() => {
  const fileUrl = new URL("./snapshots/toto.txt", import.meta.url);
  writeFileSync(fileUrl);
  try {
    takeDirectorySnapshot(fileUrl);
    throw new Error("should throw");
  } catch (e) {
    const actual = e.message;
    const expected = `directory expected at ${fileUrl}/`;
    assert({ actual, expected });
  }
});

// snapshot never stored on filesystem + nothing written
test(() => {
  removeDirectorySync(snapshotsDirectoryUrl);
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  directorySnapshot.compare();
});

// snapshot never stored on filesystem + nothing written
test(() => {
  removeDirectorySync(snapshotsDirectoryUrl);
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  directorySnapshot.compare();
});

// compare empty with empty
test(() => {
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  directorySnapshot.compare();
});

// missing file
test(() => {
  copyDirectorySync({
    from: new URL("./fixtures/0_reference/", import.meta.url),
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  copyDirectorySync({
    from: new URL("./fixtures/1_missing_file/", import.meta.url),
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  try {
    directorySnapshot.compare();
    throw new Error("should throw");
  } catch (e) {
    const actual = e.message;
    const expected = `snapshot comparison failed for "snapshots/"
--- reason ---
"file.txt" is missing
--- file missing ---
${new URL("./file.txt", snapshotsDirectoryUrl)}`;
    assert({ actual, expected });
  }
});

// extra file
test(() => {
  copyDirectorySync({
    from: new URL("./fixtures/0_reference/", import.meta.url),
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  copyDirectorySync({
    from: new URL("./fixtures/2_extra_file/", import.meta.url),
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  try {
    directorySnapshot.compare();
    throw new Error("should throw");
  } catch (e) {
    const actual = e.message;
    const expected = `snapshot comparison failed for "snapshots/"
--- reason ---
"hello.js" is unexpected
--- file unexpected ---
${new URL("./hello.js", snapshotsDirectoryUrl)}`;
    assert({ actual, expected });
  }
});

// unexpected content
test(() => {
  copyDirectorySync({
    from: new URL("./fixtures/0_reference/", import.meta.url),
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  copyDirectorySync({
    from: new URL("./fixtures/3_unexpected_file_content/", import.meta.url),
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  try {
    directorySnapshot.compare();
    throw new Error("should throw");
  } catch (e) {
    const actual = e.message;
    const expected = `snapshot comparison failed for "b.js"
--- reason ---
unexpected character in file content
--- details ---
console.log("c");
             ^ unexpected "c", expected to continue with 'b");'…
--- path ---
[13]
--- file ---
${snapshotsDirectoryUrl}b.js`;
    assert({ actual, expected });
  }
});

// content is the same
test(() => {
  copyDirectorySync({
    from: new URL("./fixtures/0_reference/", import.meta.url),
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  const fileStructureBeforeTest = readFileStructureSync(snapshotsDirectoryUrl);
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  copyDirectorySync({
    from: new URL("./fixtures/0_reference/", import.meta.url),
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  directorySnapshot.compare();
  const fileStructureAfterComparison = readFileStructureSync(
    snapshotsDirectoryUrl,
  );
  const actual = fileStructureBeforeTest;
  const expected = fileStructureAfterComparison;
  assert({ actual, expected });
});
