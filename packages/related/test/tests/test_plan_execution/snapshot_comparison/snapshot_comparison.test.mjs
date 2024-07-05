import { writeFileSync } from "node:fs";
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";
import { assert } from "@jsenv/assert";

const test = async (fileToExecute) => {
  writeFileSync(
    new URL("./node_client/my_snapshots/file.txt", import.meta.url),
    "a",
  );
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
      "**/snapshots/": true,
    },
    githubCheck: false,
  });
};

try {
  await test("file_writing_b.js");
  throw new Error("should throw");
} catch (e) {
  const actual = e;
  const expect = new Error();
  assert({ actual, expect });
}
