import { assert } from "@jsenv/assert";
import {
  clearDirectorySync,
  readFileStructureSync,
  removeFileSync,
  writeFileSync,
} from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { existsSync } from "node:fs";

clearDirectorySync(new URL("./side_effects/", import.meta.url));

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
    "1_second/second.txt": "",
  };
  assert({ actual, expect });
  // we have to clean this scenario ourselve for now
  // ideally we would auto remove the file but for @jsenv/assert this is problematic
  removeFileSync(
    new URL(
      "./side_effects/snapshot_tests_out_clear/1_second/second.txt",
      import.meta.url,
    ),
  );
}

// writing a deep directory gets undone
await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_first", () => {
      writeFileSync(new URL("./dir/deep/tata.txt", import.meta.url));
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
  const actual = existsSync(new URL("./dir/", import.meta.url));
  const expect = false;
  assert({ actual, expect });
}
