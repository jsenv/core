import { assert } from "@jsenv/assert"

import { sortByDependencies } from "@jsenv/core/src/kitchen/url_graph/sort_by_dependencies.js"

// when both have dependencies, but one depends an an other, the other must come first
{
  const actual = sortByDependencies({
    "a.js": {
      dependencies: ["b.js"],
    },
    "b.js": {
      dependencies: ["img.png"],
    },
    "img.png": {
      dependencies: [],
    },
  })
  const expected = ["img.png", "b.js", "a.js"]
  expected.circular = []
  assert({ actual, expected })
}

{
  const actual = sortByDependencies({
    "b.js": {
      dependencies: ["img.png"],
    },
    "a.js": {
      dependencies: ["b.js"],
    },
    "img.png": {
      dependencies: [],
    },
  })
  const expected = ["img.png", "b.js", "a.js"]
  expected.circular = []
  assert({ actual, expected })
}
