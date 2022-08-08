import { assert } from "@jsenv/assert"

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution"

const { type, url } = applyNodeEsmResolution({
  parentUrl: new URL("./root/src/toto/index.js", import.meta.url),
  specifier: "#src/dir/file.js",
})
const actual = {
  type,
  url,
}
const expected = {
  type: "field:imports",
  url: new URL("./root/src/dir/file.js", import.meta.url).href,
}
assert({ actual, expected })
