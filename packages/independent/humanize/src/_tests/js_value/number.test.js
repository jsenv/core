// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/test/numeric-separators-style.mjs

import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(0);
  const expected = "0";
  assert({ actual, expected });
}

{
  const actual = humanize(1);
  const expected = "1";
  assert({ actual, expected });
}

{
  const actual = humanize(-0);
  const expected = "-0";
  assert({ actual, expected });
}

{
  const actual = humanize(NaN);
  const expected = "NaN";
  assert({ actual, expected });
}

{
  const actual = humanize(Infinity);
  const expected = "Infinity";
  assert({ actual, expected });
}

{
  const actual = humanize(-Infinity);
  const expected = "-Infinity";
  assert({ actual, expected });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new Number(0));
  const expected = "Number(0)";
  assert({ actual, expected });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new Number(0), { parenthesis: true });
  const expected = "(Number(0))";
  assert({ actual, expected });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new Number(0), { useNew: true });
  const expected = "new Number(0)";
  assert({ actual, expected });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new Number(0), { parenthesis: true, useNew: true });
  const expected = "new (Number(0))";
  assert({ actual, expected });
}

// numeric separator - numbers
{
  const actual = humanize(1235);
  const expected = "1235";
  assert({ actual, expected });
}

{
  const actual = humanize(67000);
  const expected = "67_000";
  assert({ actual, expected });
}

{
  const actual = humanize(149600000);
  const expected = "149_600_000";
  assert({ actual, expected });
}

{
  const actual = humanize(1_464_301);
  const expected = "1_464_301";
  assert({ actual, expected });
}

// decimal
{
  const actual = humanize(1234.56);
  const expected = "1234.56";
  assert({ actual, expected });
}

{
  const actual = humanize(12345.67);
  const expected = "12_345.67";
  assert({ actual, expected });
}

{
  const actual = humanize(-0.120123);
  const expected = "-0.120123";
  assert({ actual, expected });
}

// negative
{
  const actual = humanize(-1000001);
  const expected = "-1_000_001";
  assert({ actual, expected });
}

// exponential
{
  const actual = humanize(-1.23456e105);
  const expected = "-1.23456e+105";
  assert({ actual, expected });
}

{
  const actual = humanize(-1200000e5);
  const expected = "-120_000_000_000";
  assert({ actual, expected });
}

{
  // prettier-ignore
  const actual = humanize(3.65432E12)
  const expected = "3_654_320_000_000";
  assert({ actual, expected });
}

// numeric separator - binary
{
  const actual = humanize(0b10101010101010);
  const expected = "10_922";
  assert({ actual, expected });
}

{
  // prettier-ignore
  const actual = humanize(0B10101010101010)
  const expected = "10_922";
  assert({ actual, expected });
}

// numeric separator - hexadecimal
{
  const actual = humanize(0xfabf00d);
  const expected = "262_926_349";
  assert({ actual, expected });
}

{
  // prettier-ignore
  const actual = humanize(0xABCDEF)
  // prettier-ignore
  const expected = "11_259_375"
  assert({ actual, expected });
}

// numeric separator - octal
{
  const actual = humanize(0o010101010101);
  const expected = "1_090_785_345";
  assert({ actual, expected });
}

{
  // prettier-ignore
  const actual = humanize(0O010101010101)
  const expected = "1_090_785_345";
  assert({ actual, expected });
}
