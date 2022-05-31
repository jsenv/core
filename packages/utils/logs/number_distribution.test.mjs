import { assert } from "@jsenv/assert"

import { distributeNumbers } from "./number_distribution.js"

{
  const actual = distributeNumbers({
    a: 56052,
    b: 222878,
  })
  const expected = {
    a: "0.2",
    b: "0.8",
  }
  assert({ actual, expected })
}

{
  const actual = distributeNumbers({
    a: 10,
    b: 90,
  })
  const expected = {
    a: "0.1",
    b: "0.9",
  }
  assert({ actual, expected })
}

{
  const actual = distributeNumbers({
    a: 1,
    b: 10,
    c: 100,
    d: 889,
  })
  const expected = {
    a: "0.00",
    b: "0.01",
    c: "0.10",
    d: "0.89",
  }
  assert({ actual, expected })
}
