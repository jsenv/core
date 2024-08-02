import { assert } from "@jsenv/assert";
import { readFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";

await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_first", () => {
      writeFileSync(new URL("./first.txt", import.meta.url));
    });
    test("1_second", () => {
      writeFileSync(new URL("./second.txt", import.meta.url));
    });
  },
  {
    throwWhenDiff: false,
    filesystemEffects: {
      textualFilesIntoDirectory: true,
    },
  },
);
{
  const actual = readFileStructureSync(
    new URL("./side_effects/snapshot_tests_out_clear/", import.meta.url),
  );
  const expect = {
    "0_first/first.txt": "",
    "1_second/second.txt": "",
  };
  assert({ actual, expect });
}

// now re-run it but it will write tata.txt
await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_first", () => {
      writeFileSync(new URL("./tata.txt", import.meta.url));
    });
  },
  {
    throwWhenDiff: false,
    filesystemEffects: {
      textualFilesIntoDirectory: true,
    },
  },
);
{
  const actual = readFileStructureSync(
    new URL("./side_effects/snapshot_tests_out_clear/", import.meta.url),
  );
  const expect = {
    "0_first/tata.txt": "",
  };
  assert({ actual, expect });
}
