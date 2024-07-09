import { assert } from "@jsenv/assert";

import { createIsInsideFragment } from "@jsenv/test/src/execution/is_inside_fragment.js";

const test = (executionArray, fragments) => {
  const result = {};
  for (const fragment of Object.keys(fragments)) {
    const isInsideFragment = createIsInsideFragment(
      fragment,
      executionArray.length,
    );
    const enabled = [];
    let index = 0;
    while (index < executionArray.length) {
      const execution = executionArray[index];
      if (isInsideFragment(index)) {
        enabled.push(execution);
      }
      index++;
    }
    result[fragment] = enabled;
  }
  assert({
    actual: result,
    expect: fragments,
  });
};

test(["a"], {
  "1/2": ["a"],
  "2/2": [],
});
test(["a", "b"], {
  "1/2": ["a"],
  "2/2": ["b"],
});
test(["a", "b"], {
  "1/3": ["a"],
  "2/3": ["b"],
  "3/3": [],
});
test(["a", "b", "c"], {
  "1/3": ["a"],
  "2/3": ["b"],
  "3/3": ["c"],
});
test(["a", "b", "c"], {
  "1/2": ["a", "b"],
  "2/2": ["c"],
});
test(["a", "b", "c", "d"], {
  "1/2": ["a", "b"],
  "2/2": ["c", "d"],
});
test(["a", "b", "c", "d"], {
  "1/3": ["a", "b"],
  "2/3": ["c", "d"],
  "3/3": [],
});
test(["a", "b", "c", "d"], {
  "1/4": ["a"],
  "2/4": ["b"],
  "3/4": ["c"],
  "4/4": ["d"],
});
test(["a", "b", "c", "d", "e"], {
  "1/3": ["a", "b"],
  "2/3": ["c", "d"],
  "3/3": ["e"],
});
test(["a", "b", "c", "d", "e", "f"], {
  "1/3": ["a", "b"],
  "2/3": ["c", "d"],
  "3/3": ["e", "f"],
});
