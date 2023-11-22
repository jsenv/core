import { assert } from "@jsenv/assert";
import { resolveUrl } from "@jsenv/urls";

import {
  clearDirectorySync,
  writeFileStructureSync,
  readFileStructureSync,
  ensureEmptyDirectory,
} from "@jsenv/filesystem";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

try {
  writeFileStructureSync(tempDirectoryUrl, {
    src: {
      "a.js": 'console.log("a");\n',
    },
  });
  clearDirectorySync(tempDirectoryUrl);
  const names = readFileStructureSync(tempDirectoryUrl);
  assert({
    actual: names,
    expected: [],
  });
} finally {
  await ensureEmptyDirectory(tempDirectoryUrl);
}
