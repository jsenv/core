import { assert } from "@jsenv/assert";

import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";

const isWindows = process.platform === "win32";

try {
  assertAndNormalizeDirectoryUrl();
  throw new Error("should throw");
} catch (actual) {
  const expect = new TypeError(
    "directoryUrl must be a string or an url, got undefined",
  );
  assert({ actual, expect });
}

try {
  assertAndNormalizeDirectoryUrl("http://example.com");
  throw new Error("should throw");
} catch (actual) {
  const expect = new TypeError(
    `directoryUrl must start with "file://", got http://example.com`,
  );
  assert({ actual, expect });
}

{
  const actual = assertAndNormalizeDirectoryUrl("file:///directory");
  const expect = "file:///directory/";
  assert({ actual, expect });
}

if (isWindows) {
  const actual = assertAndNormalizeDirectoryUrl("C:/directory");
  const expect = "file:///C:/directory/";
  assert({ actual, expect });
} else {
  const actual = assertAndNormalizeDirectoryUrl("/directory");
  const expect = "file:///directory/";
  assert({ actual, expect });
}

{
  const actual = assertAndNormalizeDirectoryUrl(new URL("file:///directory"));
  const expect = "file:///directory/";
  assert({ actual, expect });
}
