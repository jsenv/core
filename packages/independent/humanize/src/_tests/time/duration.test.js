import { assert } from "@jsenv/assert";

import { humanizeDuration } from "@jsenv/humanize";

const test = (durationInMs, expected) => {
  const actual = humanizeDuration(durationInMs);
  assert({ actual, expected });
};

test(0.1, "0 second");
test(1.02, "0.001 second");
test(1.52, "0.002 second");
test(52, "0.05 second");
test(55, "0.06 second");
test(99, "0.1 second");
test(999, "1 second");
test(1_421, "1.4 seconds");
test(61_421, "1 minute and 1 second");
test(3_601_200, "1 hour");
test(7_651_200, "2 hours and 8 minutes");
