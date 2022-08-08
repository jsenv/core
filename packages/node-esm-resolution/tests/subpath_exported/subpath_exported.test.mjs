import { assert } from "@jsenv/assert"

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution"

const { type, url } = applyNodeEsmResolution({
  parentUrl: new URL("./root/index.js", import.meta.url),
  specifier: "@jsenv/toto/directory/file.js",
})
const actual = {
  type,
  url,
}
const expected = {
  type: "field:exports",
  url: new URL(
    "./root/node_modules/@jsenv/toto/directory/file.js",
    import.meta.url,
  ).href,
}
assert({ actual, expected })
