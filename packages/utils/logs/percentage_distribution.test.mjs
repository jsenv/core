import { assert } from "@jsenv/assert"

import { distributePercentages } from "./percentage_distribution.js"

{
  const actual = distributePercentages({
    a: 1,
    b: 999,
  })
  const expected = {
    a: "0.1 %",
    b: "99.9 %",
  }
  assert({ actual, expected })
}

{
  const actual = distributePercentages({
    a: 1,
    b: 9999,
  })
  const expected = {
    a: "0.01 %",
    b: "99.99 %",
  }
  assert({ actual, expected })
}

{
  const actual = distributePercentages({
    a: 1,
    b: 99999,
  })
  const expected = {
    a: "0.001 %",
    b: "99.999 %",
  }
  assert({ actual, expected })
}

{
  const actual = distributePercentages({
    a: 56052,
    b: 222878,
  })
  const expected = {
    a: "20 %",
    b: "80 %",
  }
  assert({ actual, expected })
}

{
  const actual = distributePercentages({
    a: 10,
    b: 90,
  })
  const expected = {
    a: "10 %",
    b: "90 %",
  }
  assert({ actual, expected })
}

{
  const actual = distributePercentages({
    a: 1,
    b: 10,
    c: 100,
    d: 889,
  })
  const expected = {
    a: "0.1 %",
    b: "1 %",
    c: "10 %",
    d: "88.9 %",
  }
  assert({ actual, expected })
}
