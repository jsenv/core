import { assert } from "@jsenv/assert";

import { collectFiles } from "@jsenv/filesystem";

const files = await collectFiles({
  directoryUrl: new URL("./root/dir with spaces", import.meta.url),
  associations: {
    any: { "**/*": true },
  },
  predicate: ({ any }) => any,
});
const actual = files.map((file) => file.relativeUrl);
const expected = ["subdir with spaces/a b.js", "file.js"];
assert({ actual, expected });
