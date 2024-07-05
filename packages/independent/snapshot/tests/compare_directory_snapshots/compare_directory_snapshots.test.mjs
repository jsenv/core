import stripAnsi from "strip-ansi";
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
    const expect = `directory expected at ${fileUrl}/`;
    assert({ actual, expect });
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
    const actual = stripAnsi(e.message);
    const expect = `snapshot comparison failed for "snapshots/"
--- reason ---
"file.txt" directory entry is missing
--- missing entry ---
${new URL("./file.txt", snapshotsDirectoryUrl)}`;
    assert({ actual, expect });
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
    const actual = stripAnsi(e.message);
    const expect = `snapshot comparison failed for "snapshots/"
--- reason ---
"hello.js" directory entry is unexpected
--- unexpected entry ---
${new URL("./hello.js", snapshotsDirectoryUrl)}`;
    assert({ actual, expect });
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
    const actual = stripAnsi(e.message);
    const expect = `snapshot comparison failed for "b.js"

actual: 1| console.log("c");
        2| 
expect: 1| console.log("b");
        2| 
--- details ---
"${snapshotsDirectoryUrl}b.js"
---------------`;
    assert({ actual, expect });
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
  const expect = fileStructureAfterComparison;
  assert({ actual, expect });
});
