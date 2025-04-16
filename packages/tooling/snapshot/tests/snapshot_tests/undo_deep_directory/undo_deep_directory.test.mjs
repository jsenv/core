import { assert } from "@jsenv/assert";
import {
  removeDirectorySync,
  writeFileStructureSync,
  writeFileSync,
} from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { existsSync } from "node:fs";

removeDirectorySync(new URL("./dir/", import.meta.url), {
  allowUseless: true,
});
writeFileStructureSync(new URL("./git_ignored/", import.meta.url), {});
await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_first", () => {
      writeFileSync(new URL("./dir/deep/tata.txt", import.meta.url));
    });
  },
  {
    outFilePattern: "./git_ignored/[filename]",
    filesystemEffects: {
      textualFilesInline: true,
    },
  },
);
const actual = existsSync(new URL("./dir/", import.meta.url));
const expect = false;
assert({ actual, expect });
