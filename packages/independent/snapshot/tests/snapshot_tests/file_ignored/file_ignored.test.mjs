/*
 * Simulate what happens when some files are
 * written locally and tracked by git
 * but would not be generated in CI
 * (for example .gif files generated for doc)
 */

import { assert } from "@jsenv/assert";
import { writeFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { existsSync } from "node:fs";

const outDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const fileTxtUrl = new URL("./output/file.txt", import.meta.url);
writeFileStructureSync(outDirectoryUrl, {});
// 1. a first execution who writes file.txt
await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_first", () => {
      writeFileSync(fileTxtUrl, "a");
    });
  },
  {
    outFilePattern: "./git_ignored/first/[filename]",
    throwWhenDiff: false,
    filesystemActions: {
      "**/*.txt": "ignore",
    },
  },
);
const existsAfterFirstRun = existsSync(fileTxtUrl);
// 2. a second execution does not write the file, but we want to ignore it
await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_first", () => {});
  },
  {
    outFilePattern: "./git_ignored/second/[filename]",
    throwWhenDiff: true,
    filesystemActions: {
      "**/*.txt": "ignore",
    },
  },
);
const existsAfterSecondRun = existsSync(fileTxtUrl);
const actual = {
  existsAfterFirstRun,
  existsAfterSecondRun,
};
const expect = {
  existsAfterFirstRun: true,
  existsAfterSecondRun: true,
};
assert({ actual, expect });
