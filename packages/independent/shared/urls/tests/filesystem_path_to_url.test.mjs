import { assert } from "@jsenv/assert";

import { fileSystemPathToUrl } from "@jsenv/urls";

const isWindows = process.platform === "win32";

if (isWindows) {
  const actual = fileSystemPathToUrl("C:/Users/file.js");
  const expect = "file:///C:/Users/file.js";
  assert({ actual, expect });
} else {
  const actual = fileSystemPathToUrl("/Users/file.js");
  const expect = "file:///Users/file.js";
  assert({ actual, expect });
}

try {
  fileSystemPathToUrl("file:///Users/file.js");
  throw new Error("should throw");
} catch (actual) {
  const expect = new Error(
    `value must be a filesystem path, got file:///Users/file.js`,
  );
  assert({ actual, expect });
}
