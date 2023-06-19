import { assert } from "@jsenv/assert";

import { sortByDependencies } from "@jsenv/core/src/kitchen/url_graph/sort_by_dependencies.js";

// when both have dependencies, but one depends an an other, the other must come first
{
  const actual = sortByDependencies({
    "a.js": {
      dependencyUrlSet: new Set(["b.js"]),
    },
    "b.js": {
      dependencyUrlSet: new Set(["img.png"]),
    },
    "img.png": {
      dependencyUrlSet: new Set(),
    },
  });
  const expected = ["img.png", "b.js", "a.js"];
  expected.circular = [];
  assert({ actual, expected });
}

{
  const actual = sortByDependencies({
    "b.js": {
      dependencyUrlSet: new Set(["img.png"]),
    },
    "a.js": {
      dependencyUrlSet: new Set(["b.js"]),
    },
    "img.png": {
      dependencyUrlSet: new Set(),
    },
  });
  const expected = ["img.png", "b.js", "a.js"];
  expected.circular = [];
  assert({ actual, expected });
}
