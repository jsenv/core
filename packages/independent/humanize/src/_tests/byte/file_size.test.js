import { assert } from "@jsenv/assert";

import { inspectFileSize } from "@jsenv/inspect";

const test = (fileSize, expected) => {
  const actual = inspectFileSize(fileSize);
  assert({ actual, expected });
};

test(0, "0 B");
test(1, "1 B");
test(1000, "1 kB");
test(1110, "1.1 kB");
test(1010, "1 kB");
test(10100, "10.1 kB");
test(100100, "100 kB");
test(1000100, "1 MB");
test(1100000, "1.1 MB");
