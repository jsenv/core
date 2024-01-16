import { assert } from "@jsenv/assert";

import { distributePercentages } from "@jsenv/inspect";

const test = (namedNumbers, expected) => {
  const actual = distributePercentages(namedNumbers);
  assert({ actual, expected });
};

test(
  {
    css: 24,
    html: 707,
    js: 6367,
    json: 0,
    other: 9997,
  },
  {
    css: 0.1,
    html: 4.1,
    js: 37.2,
    json: 0,
    other: 58.6,
  },
);
test(
  {
    a: 1,
    b: 999,
  },
  {
    a: 0.1,
    b: 99.9,
  },
);
test(
  {
    a: 1,
    b: 9_999,
  },
  {
    a: 0.01,
    b: 99.99,
  },
);
test(
  {
    a: 1,
    b: 99_999,
  },
  {
    a: 0.001,
    b: 99.999,
  },
);
test(
  {
    a: 56_052,
    b: 222_878,
  },
  {
    a: 20,
    b: 80,
  },
);
test(
  {
    a: 10,
    b: 90,
  },
  {
    a: 10,
    b: 90,
  },
);
test(
  {
    a: 1,
    b: 10,
    c: 100,
    d: 889,
  },
  {
    a: 0.1,
    b: 1,
    c: 10,
    d: 88.9,
  },
);
