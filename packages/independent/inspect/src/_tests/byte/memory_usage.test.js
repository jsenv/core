import { assert } from "@jsenv/assert";

import { inspectMemoryUsage } from "@jsenv/inspect";

const test = (memoryUsageInBytes, expected) => {
  const actual = inspectMemoryUsage(memoryUsageInBytes);
  assert({ actual, expected });
};

test(1000, "1.0 kB");
test(1100, "1.1 kB");
