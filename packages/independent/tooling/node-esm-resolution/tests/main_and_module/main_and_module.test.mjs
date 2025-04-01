import { assert } from "@jsenv/assert";
import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";

const { type, url } = applyNodeEsmResolution({
  parentUrl: import.meta.resolve("./root/index.js"),
  specifier: "dep",
});
const actual = {
  type,
  url,
};
const expect = {
  type: "field:module",
  url: import.meta.resolve("./root/node_modules/dep/index.mjs"),
};
assert({ actual, expect });
