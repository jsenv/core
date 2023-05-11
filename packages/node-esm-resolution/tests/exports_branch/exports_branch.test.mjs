import { assert } from "@jsenv/assert";

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";

{
  const { type, url } = applyNodeEsmResolution({
    conditions: ["browser", "import", "development"],
    parentUrl: new URL("./root/main.js", import.meta.url),
    specifier: "foo",
  });
  const actual = {
    type,
    url,
  };
  const expected = {
    type: "field:exports",
    url: new URL("./root/node_modules/foo/main.browser.js", import.meta.url)
      .href,
  };
  assert({ actual, expected });
}

{
  const { type, url } = applyNodeEsmResolution({
    conditions: ["import", "development"],
    parentUrl: new URL("./root/main.js", import.meta.url),
    specifier: "foo",
  });
  const actual = {
    type,
    url,
  };
  const expected = {
    type: "field:exports",
    url: new URL("./root/node_modules/foo/main.js", import.meta.url).href,
  };
  assert({ actual, expected });
}
