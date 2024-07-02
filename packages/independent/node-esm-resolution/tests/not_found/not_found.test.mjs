import { fileURLToPath } from "node:url";
import { assert } from "@jsenv/assert";

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";

try {
  applyNodeEsmResolution({
    parentUrl: new URL("./root/index.js", import.meta.url),
    specifier: "foo",
  });
  throw new Error("should throw");
} catch (e) {
  const actual = e;
  const expect = new Error(
    `Cannot find "foo" imported from ${fileURLToPath(
      new URL("./root/index.js", import.meta.url),
    )}`,
  );
  expect.code = "MODULE_NOT_FOUND";
  assert({ actual, expect });
}
