/* eslint-disable no-eval */
import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const value = BigInt(1);
  const actual = humanize(value);
  const expected = "1n";
  assert({ actual, expected });
}

{
  const value = 2n;
  const actual = humanize(value);
  const expected = "2n";
  assert({ actual, expected });
}

{
  const value = Object(BigInt(1));
  const actual = humanize(value);
  const expected = "BigInt(1n)";
  assert({ actual, expected });
}

{
  const actual = humanize(1234567n);
  const expected = "1234567n";
  assert({ actual, expected });
}

{
  const actual = humanize(19223n);
  const expected = "19223n";
  assert({ actual, expected });
}
