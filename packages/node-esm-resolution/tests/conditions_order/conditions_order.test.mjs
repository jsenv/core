import { assert } from "@jsenv/assert"

import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution"

{
  const { type, url } = applyNodeEsmResolution({
    conditions: ["node", "import"],
    parentUrl: new URL("./import_first/index.js", import.meta.url),
    specifier: "#foo",
  })
  const actual = {
    type,
    url,
  }
  const expected = {
    type: "imports_subpath",
    url: new URL("./import_first/import.js", import.meta.url).href,
  }
  assert({ actual, expected })
}

{
  const { type, url } = applyNodeEsmResolution({
    conditions: ["node", "import"],
    parentUrl: new URL("./node_first/index.js", import.meta.url),
    specifier: "#foo",
  })
  const actual = {
    type,
    url,
  }
  const expected = {
    type: "imports_subpath",
    url: new URL("./node_first/node.js", import.meta.url).href,
  }
  assert({ actual, expected })
}
