import { assert } from "@jsenv/assert";

import { humanizeEllapsedTime } from "@jsenv/humanize";

const test = (durationInMs, expect) => {
  const actual = humanizeEllapsedTime(durationInMs);
  assert({ actual, expect });
};

test(2200, "2 seconds");
