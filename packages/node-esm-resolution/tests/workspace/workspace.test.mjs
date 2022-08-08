import { assert } from "@jsenv/assert"

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution"

const { type, url } = applyNodeEsmResolution({
  parentUrl: new URL("./root/packages/util/index.js", import.meta.url),
  specifier: "foo",
})
const actual = {
  type,
  url,
}
const expected = {
  type: "field:exports",
  url: new URL("./root/node_modules/foo/file.js", import.meta.url).href,
}
assert({ actual, expected })
