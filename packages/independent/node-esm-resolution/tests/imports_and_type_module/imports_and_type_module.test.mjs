import { assert } from "@jsenv/assert";

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";

const { type, url } = applyNodeEsmResolution({
  parentUrl: new URL("./root/water/water.js", import.meta.url),
  specifier: "#fire/fire.js",
});
const actual = {
  type,
  url,
};
const expect = {
  type: "field:imports",
  url: new URL("./root/fire/fire.js", import.meta.url).href,
};
assert({ actual, expect });
