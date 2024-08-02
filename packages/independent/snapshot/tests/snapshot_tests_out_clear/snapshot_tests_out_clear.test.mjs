import { assert } from "@jsenv/assert";
import { readFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";

await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_basic", () => {
      writeFileSync(new URL("./toto.txt", import.meta.url));
    });
  },
  {
    filesystemEffects: {
      textualFilesIntoDirectory: true,
    },
  },
);
// now re-run it but it will write tata.txt
const { dirUrlMap } = await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_basic", () => {
      writeFileSync(new URL("./tata.txt", import.meta.url));
    });
  },
  {
    filesystemEffects: {
      textualFilesIntoDirectory: true,
    },
  },
);

// - it should not have toto.txt
const testDirUrl = dirUrlMap.get("0_basic");
const actual = readFileStructureSync(`${testDirUrl}`);
const expect = {
  "tata.txt": "",
};
assert({ actual, expect });
