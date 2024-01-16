import { assert } from "@jsenv/assert";

import { humanizeEllapsedTime } from "@jsenv/humanize";

const test = (durationInMs, expected) => {
  const actual = humanizeEllapsedTime(durationInMs);
  assert({ actual, expected });
};

test(2200, "2 seconds");
