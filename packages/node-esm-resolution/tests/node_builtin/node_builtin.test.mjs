import { assert } from "@jsenv/assert"

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution"

const { type, url } = applyNodeEsmResolution({
  parentUrl: new URL("./root/index.js", import.meta.url),
  specifier: "node:fs",
})
const actual = {
  type,
  url,
}
const expected = {
  type: "node_builtin_specifier",
  url: "node:fs",
}
assert({ actual, expected })
