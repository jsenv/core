import { assert } from "@jsenv/assert";

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";

const { type, url } = applyNodeEsmResolution({
  parentUrl: new URL("./root/index.js", import.meta.url),
  specifier: "@jsenv/toto",
});
const actual = {
  type,
  url,
};
const expect = {
  type: "field:exports",
  url: new URL("./root/node_modules/@jsenv/toto/main.js", import.meta.url).href,
};
assert({ actual, expect });
