import { readdirSync } from "node:fs";
import { assert } from "@jsenv/assert";
import { saveSnapshotOnFileSystem } from "@jsenv/snapshot";

import {
  clearDirectorySync,
  ensureEmptyDirectorySync,
} from "@jsenv/filesystem";

const tempDirectoryUrl = new URL("./temp/", import.meta.url);
ensureEmptyDirectorySync(tempDirectoryUrl);

try {
  saveSnapshotOnFileSystem(
    {
      "src/a.js": 'console.log("a");\n',
    },
    tempDirectoryUrl,
  );
  clearDirectorySync(tempDirectoryUrl);
  const names = readdirSync(tempDirectoryUrl);
  assert({
    actual: names,
    expected: [],
  });
} finally {
  ensureEmptyDirectorySync(tempDirectoryUrl);
}
