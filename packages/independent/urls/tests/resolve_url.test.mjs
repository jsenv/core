import { assert } from "@jsenv/assert";

import { resolveUrl } from "@jsenv/urls";

{
  const actual = resolveUrl("./file.js", "file:///directory/");
  const expect = "file:///directory/file.js";
  assert({ actual, expect });
}

{
  const specifier = "./foo.js";

  try {
    resolveUrl(specifier);
    throw new Error("should throw");
  } catch (actual) {
    const expect = new TypeError(`baseUrl missing to resolve ${specifier}`);
    assert({ actual, expect });
  }
}
