import { assert } from "@jsenv/assert";

import { memoize } from "@jsenv/utils/src/memoize/memoize.js";

{
  let callCount = 0;
  const fn = memoize(() => {
    callCount++;
    return 42;
  });

  // basic memoization is working
  {
    const actual = {
      value: fn(),
      callCount,
    };
    const expected = {
      value: 42,
      callCount: 1,
    };
    assert({ actual, expected });
  }
  {
    const actual = {
      value: fn(),
      callCount,
    };
    const expected = {
      value: 42,
      callCount: 1,
    };
    assert({ actual, expected });
  }

  // forget works as expected
  fn.forget();
  {
    const actual = {
      value: fn(),
      callCount,
    };
    const expected = {
      value: 42,
      callCount: 2,
    };
    assert({ actual, expected });
  }

  // after being forgotten memoization still works
  {
    const actual = {
      value: fn(),
      callCount,
    };
    const expected = {
      value: 42,
      callCount: 2,
    };
    assert({ actual, expected });
  }
}

// test for recursive function here
{
  let callCount = 0;
  let value = 0;
  const fn = () => {
    callCount++;
    value++;
    if (value === 3) return 3;
    return fn();
  };
  const memoized = memoize(fn);
  const actual = {
    value: memoized(),
    callCount,
  };
  const expected = {
    value: 3,
    callCount: 3,
  };
  assert({ actual, expected });
}
