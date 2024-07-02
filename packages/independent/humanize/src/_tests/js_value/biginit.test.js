/* eslint-disable no-eval */
import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const value = BigInt(1);
  const actual = humanize(value);
  const expect = "1n";
  assert({ actual, expect });
}

{
  const value = 2n;
  const actual = humanize(value);
  const expect = "2n";
  assert({ actual, expect });
}

{
  const value = Object(BigInt(1));
  const actual = humanize(value);
  const expect = "BigInt(1n)";
  assert({ actual, expect });
}

{
  const actual = humanize(1234567n);
  const expect = "1234567n";
  assert({ actual, expect });
}

{
  const actual = humanize(19223n);
  const expect = "19223n";
  assert({ actual, expect });
}
