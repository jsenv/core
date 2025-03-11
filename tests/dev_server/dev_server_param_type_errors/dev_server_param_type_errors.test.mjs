import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

try {
  await startDevServer({ sourceDirectoryUl: new URL("./", import.meta.url) });
  throw new Error("should throw");
} catch (e) {
  const actual = e;
  const expect = new TypeError(`sourceDirectoryUl: there is no such param`);
  assert({ actual, expect });
}

try {
  await startDevServer({ sourceDirectoryUrl: undefined });
  throw new Error("should throw");
} catch (e) {
  const actual = e;
  const expect = new TypeError(
    `sourceDirectoryUrl must be a string or an url, got undefined`,
  );
  assert({ actual, expect });
}
