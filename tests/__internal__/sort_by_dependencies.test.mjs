import { assert } from "@jsenv/assert";

import { sortByDependencies } from "@jsenv/core/src/kitchen/url_graph/sort_by_dependencies.js";

// when both have dependencies, but one depends an an other, the other must come first
{
  const actual = sortByDependencies({
    "a.js": {
      referenceToOthersSet: new Set([{ url: "b.js" }]),
    },
    "b.js": {
      referenceToOthersSet: new Set([{ url: "img.png" }]),
    },
    "img.png": {
      referenceToOthersSet: new Set(),
    },
  });
  const expected = ["img.png", "b.js", "a.js"];
  expected.circular = [];
  assert({ actual, expected });
}

{
  const actual = sortByDependencies({
    "b.js": {
      referenceToOthersSet: new Set([{ url: "img.png" }]),
    },
    "a.js": {
      referenceToOthersSet: new Set([{ url: "b.js" }]),
    },
    "img.png": {
      referenceToOthersSet: new Set(),
    },
  });
  const expected = ["img.png", "b.js", "a.js"];
  expected.circular = [];
  assert({ actual, expected });
}
