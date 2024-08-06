import { assert } from "@jsenv/assert";
import { writeFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { existsSync } from "node:fs";

writeFileStructureSync(
  new URL("./_undo_deep_directory.test.mjs/", import.meta.url),
  {},
);
await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_first", () => {
      writeFileSync(new URL("./dir/deep/tata.txt", import.meta.url));
    });
  },
  {
    filesystemEffects: {
      textualFilesInline: true,
    },
  },
);
const actual = existsSync(new URL("./dir/", import.meta.url));
const expect = false;
assert({ actual, expect });
writeFileStructureSync(
  new URL("./_undo_deep_directory.test.mjs/", import.meta.url),
  {},
);
