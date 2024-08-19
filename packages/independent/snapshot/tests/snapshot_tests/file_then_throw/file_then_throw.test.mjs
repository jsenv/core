/*
 * Simulate what happens when
 * 1. A test write some files
 * 2. Suddenly test starts to throw
 *
 * -> We want to see that test starts to throw, not
 * that a file that was previously written does not exists anymore
 */

import {
  replaceFileStructureSync,
  writeFileStructureSync,
  writeFileSync,
} from "@jsenv/filesystem";
import { snapshotSideEffects, snapshotTests } from "@jsenv/snapshot";

const outDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const fileTxtUrl = new URL("./output/file.txt", import.meta.url);
writeFileStructureSync(outDirectoryUrl, {});
// 1. First execution writes output/file.txt
await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("scenario", () => {
      writeFileSync(fileTxtUrl, "a");
    });
  },
  {
    executionEffects: { catch: true },
    outFilePattern: "./git_ignored/[filename]",
  },
);
replaceFileStructureSync({
  from: new URL("./scenario/", outDirectoryUrl),
  to: new URL("./result/first/", import.meta.url),
});
// 2. Second execution throw an error
await snapshotSideEffects(
  import.meta.url,
  async () => {
    try {
      await snapshotTests(
        import.meta.url,
        ({ test }) => {
          test("scenario", () => {
            throw new Error("here");
          });
        },
        {
          executionEffect: { catch: true },
          throwWhenDiff: true,
          outFilePattern: "./git_ignored/[filename]",
        },
      );
    } catch (e) {
      replaceFileStructureSync({
        from: new URL("./scenario/", outDirectoryUrl),
        to: new URL("./result/second/", import.meta.url),
      });
      throw e;
    }
  },
  {
    filesystemEffects: false,
  },
);
