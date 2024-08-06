import { assert } from "@jsenv/assert";
import {
  readFileStructureSync,
  writeFileStructureSync,
  writeFileSync,
} from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";

const outDirectoryUrl = new URL("./_clear_other.test.mjs/", import.meta.url);
const fileStructures = {
  "0_at_start": {},
  "1_first_run": {
    "0_first/0_first.md": assert.any(String),
    "0_first/first.txt": "",
    "1_second/1_second.md": assert.any(String),
    "1_second/second.txt": "",
    "clear_other.test.mjs.md": assert.any(String),
  },
  "2_second_run": {
    "0_first/0_first.md": assert.any(String),
    "0_first/tata.txt": "",
    "clear_other.test.mjs.md": assert.any(String),
  },
};
writeFileStructureSync(outDirectoryUrl, fileStructures["0_at_start"]);
await snapshotTests(import.meta.url, ({ test }) => {
  test("0_first", () => {
    writeFileSync(new URL("./first.txt", import.meta.url));
  });
  test("1_second", () => {
    writeFileSync(new URL("./second.txt", import.meta.url));
  });
});
const firstRunFileStructure = readFileStructureSync(outDirectoryUrl);
await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_first", () => {
      writeFileSync(new URL("./tata.txt", import.meta.url));
    });
  },
  {
    throwWhenDiff: false,
  },
);
const secondRunFileStructure = readFileStructureSync(outDirectoryUrl);
const actual = {
  firstRunFileStructure,
  secondRunFileStructure,
};
const expect = {
  firstRunFileStructure: fileStructures["1_first_run"],
  secondRunFileStructure: fileStructures["2_second_run"],
};
assert({ actual, expect });
writeFileStructureSync(outDirectoryUrl, fileStructures["0_at_start"]);
