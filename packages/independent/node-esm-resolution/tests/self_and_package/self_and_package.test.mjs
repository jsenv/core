import { assert } from "@jsenv/assert";

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";

{
  const { type, url } = applyNodeEsmResolution({
    parentUrl: new URL("./root/index.js", import.meta.url),
    specifier: "whatever/packages/foo",
  });
  const actual = {
    type,
    url,
  };
  const expected = {
    type: "field:exports",
    url: new URL("./root/packages/foo", import.meta.url).href,
  };
  assert({ actual, expected });
}

{
  const { type, url } = applyNodeEsmResolution({
    parentUrl: new URL("./root/index.js", import.meta.url),
    specifier: "whatever/packages/foo/src/file.js",
  });
  const actual = {
    type,
    url,
  };
  const expected = {
    type: "field:exports",
    url: new URL("./root/packages/foo/src/file.js", import.meta.url).href,
  };
  assert({ actual, expected });
}

{
  const { type, url } = applyNodeEsmResolution({
    parentUrl: new URL("./root/index.js", import.meta.url),
    specifier: "whatever/packages/bar",
  });
  const actual = {
    type,
    url,
  };
  const expected = {
    type: "field:exports",
    url: new URL("./root/packages/bar", import.meta.url).href,
  };
  assert({ actual, expected });
}
