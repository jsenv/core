import { assert } from "@jsenv/assert";

import { humanizeMemory } from "@jsenv/humanize";

const test = (memoryUsageInBytes, expect) => {
  const actual = humanizeMemory(memoryUsageInBytes);
  assert({ actual, expect });
};

test(1000, "1.0 kB");
test(1100, "1.1 kB");
