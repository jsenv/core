import { readdirSync } from "node:fs";
import { assert } from "@jsenv/assert";

import {
  clearDirectorySync,
  ensureEmptyDirectorySync,
  writeFileStructureSync,
} from "@jsenv/filesystem";

const tempDirectoryUrl = new URL("./temp/", import.meta.url);
ensureEmptyDirectorySync(tempDirectoryUrl);

try {
  writeFileStructureSync(tempDirectoryUrl, {
    "src/a.js": 'console.log("a");\n',
  });
  clearDirectorySync(tempDirectoryUrl);
  const names = readdirSync(tempDirectoryUrl);
  assert({
    actual: names,
    expect: [],
  });
} finally {
  ensureEmptyDirectorySync(tempDirectoryUrl);
}
