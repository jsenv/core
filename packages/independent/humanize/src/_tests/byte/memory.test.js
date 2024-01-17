import { assert } from "@jsenv/assert";

import { humanizeMemory } from "@jsenv/humanize";

const test = (memoryUsageInBytes, expected) => {
  const actual = humanizeMemory(memoryUsageInBytes);
  assert({ actual, expected });
};

test(1000, "1.0 kB");
test(1100, "1.1 kB");
