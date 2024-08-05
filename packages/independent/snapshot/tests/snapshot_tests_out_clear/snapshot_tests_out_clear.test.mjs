import { assert } from "@jsenv/assert";
import {
  clearDirectorySync,
  readFileStructureSync,
  writeFileSync,
} from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { existsSync } from "node:fs";

clearDirectorySync(
  new URL("./_snapshot_tests_out_clear.test.mjs/", import.meta.url),
);

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
  },
);
{
  const actual = readFileStructureSync(
    new URL("./_snapshot_tests_out_clear.test.mjs/", import.meta.url),
  );
  const expect = {
    "0_first/first.txt": "",
    "1_second/second.txt": "",
    "snapshot_tests_out_clear.test.mjs.md": assert.any(String),
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
  },
);
{
  const actual = readFileStructureSync(
    new URL("./_snapshot_tests_out_clear.test.mjs/", import.meta.url),
  );
  const expect = {
    "0_first/tata.txt": "",
    "snapshot_tests_out_clear.test.mjs.md": assert.any(String),
  };
  assert({ actual, expect });
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
    filesystemEffects: {
      textualFilesInline: true,
    },
    throwWhenDiff: false,
  },
);
{
  const actual = existsSync(new URL("./dir/", import.meta.url));
  const expect = false;
  assert({ actual, expect });
}

// file.txt is deleted
writeFileSync(
  new URL("./_snapshot_tests_out_clear.test.mjs/file.txt", import.meta.url),
  "hello.txt",
);
await snapshotTests(import.meta.url, ({ test }) => {
  test("0_first", () => {});
});
{
  const actual = existsSync(
    new URL("./_snapshot_tests_out_clear.test.mjs/file.txt", import.meta.url),
  );
  const expect = false;
  assert({ actual, expect });
}
writeFileSync(
  new URL("./_snapshot_tests_out_clear.test.mjs/file.txt", import.meta.url),
  "hello.txt",
);
await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_first", () => {});
  },
  {
    filesystemActions: {
      "*.txt": "ignore",
    },
  },
);
{
  const actual = existsSync(
    new URL("./_snapshot_tests_out_clear.test.mjs/file.txt", import.meta.url),
  );
  const expect = true;
  assert({ actual, expect });
}
