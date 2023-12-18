import { assert } from "@jsenv/assert";

import { inspectEllapsedTime } from "@jsenv/inspect";

const test = (durationInMs, expected) => {
  const actual = inspectEllapsedTime(durationInMs);
  assert({ actual, expected });
};

test(2200, "2 seconds");
