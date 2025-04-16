import { collectFiles } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";

await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_basic", async () => {
      const matchingFileResultArray = await collectFiles({
        directoryUrl: new URL("./fixtures/", import.meta.url),
        associations: {
          testPlan: {
            "./**/*.spec.js": { node: true },
            "./**/foo/": { node: null },
          },
        },
        predicate: ({ testPlan }) => testPlan,
      });
      const filesMatching = [];
      const filesWithNodeMetaMatching = [];
      for (const file of matchingFileResultArray) {
        filesMatching.push(file.relativeUrl);
        if (file.meta.testPlan.node) {
          filesWithNodeMetaMatching.push(file.relativeUrl);
        }
      }
      return { filesMatching, filesWithNodeMetaMatching };
    });
  },
  { logEffects: false },
);
