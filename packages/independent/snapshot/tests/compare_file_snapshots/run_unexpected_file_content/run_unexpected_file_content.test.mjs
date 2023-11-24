import { assert } from "@jsenv/assert";

import {
  copyFileSync,
  readFileStructureSync,
  writeFileStructureSync,
} from "@jsenv/filesystem";

import { takeFileSnapshot } from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const snapshotDirectoryFileStructureBeforeTest = readFileStructureSync(
  snapshotsDirectoryUrl,
);

try {
  const fileSnapshot = takeFileSnapshot(
    new URL("./snapshots/a.js.map", import.meta.url),
  );
  copyFileSync({
    from: new URL("./fixtures/a.js.map", import.meta.url),
    to: new URL("./snapshots/a.js.map", import.meta.url),
    overwrite: true,
  });
  fileSnapshot.compare();
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `comparison with previous file snapshot failed
--- reason ---
unexpected character in "a.js.map" content
--- details ---
{
  "sources": [
    "b"
     ^ unexpected "b", expected to continue with 'a"'…
  ]
}
--- path ---
[22]#L3C6
--- file ---
${snapshotsDirectoryUrl}a.js.map`;
  assert({ actual, expected });
} finally {
  writeFileStructureSync(
    snapshotsDirectoryUrl,
    snapshotDirectoryFileStructureBeforeTest,
  );
}
