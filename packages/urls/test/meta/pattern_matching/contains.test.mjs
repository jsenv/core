import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/urls"

const test = ({ pattern, url }) => {
  return URL_META.applyPatternMatching({
    pattern: new URL(pattern, "file:///").href,
    url: new URL(url, "file:///").href,
  }).matched
}

{
  const actual = test({
    pattern: "./dist/cdn/*photon.*.js",
    url: "./dist/cdn/photon.hash.js",
  })
  const expected = false
  assert({ actual, expected })
}

{
  const actual = test({
    pattern: "./dist/cdn/*photon.*.js",
    url: "./dist/cdn/photon_startscreen.hash.js",
  })
  const expected = false
  assert({ actual, expected })
}

{
  const actual = test({
    pattern: "file:///dist/cdn/**photon**.*.js",
    url: "./dist/cdn/photon.hash.js",
  })
  const expected = true
  assert({ actual, expected })
}

{
  const actual = test({
    pattern: "file:///dist/cdn/**photon**.*.js",
    url: "./dist/cdn/photon_startscreen.hash.js",
  })
  const expected = true
  assert({ actual, expected })
}
