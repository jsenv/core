import { assert } from "@jsenv/assert";

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";

const { type, url } = applyNodeEsmResolution({
  parentUrl: new URL("./root/src/index.mjs", import.meta.url),
  specifier: "foo.js?test",
});
const actual = {
  type,
  url,
};
const expect = {
  type: "field:main",
  url: new URL("./root/node_modules/foo.js/entry.js?test", import.meta.url)
    .href,
};
assert({ actual, expect });
