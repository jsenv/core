/*
 * Ideally we should test many more things
 * - other files are kepts untouched
 */

import stripAnsi from "strip-ansi";
import { writeFileSync } from "node:fs";
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";
import { assert } from "@jsenv/assert";

const fileSnapshotUrl = new URL(
  "./node_client/git_ignored/file.txt",
  import.meta.url,
);
const test = async (fileToExecute) => {
  writeFileSync(fileSnapshotUrl, "a");
  await executeTestPlan({
    logs: { level: "error" },
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    testPlan: {
      [fileToExecute]: {
        node: {
          runtime: nodeWorkerThread(),
        },
      },
    },
    snapshotPlan: {
      "**/git_ignored/": true,
    },
    githubCheck: false,
  });
};

try {
  await test("file_writing_b.js");
  throw new Error("should throw");
} catch (e) {
  const actual = stripAnsi(e.message);
  const expect = `snapshot comparison failed for "file.txt"

actual: 1| b
expect: 1| a
--- details ---
"${fileSnapshotUrl}"
---------------`;
  assert({ actual, expect });
}
