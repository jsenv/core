// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/test/numeric-separators-style.mjs

import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(0);
  const expect = "0";
  assert({ actual, expect });
}

{
  const actual = humanize(1);
  const expect = "1";
  assert({ actual, expect });
}

{
  const actual = humanize(-0);
  const expect = "-0";
  assert({ actual, expect });
}

{
  const actual = humanize(NaN);
  const expect = "NaN";
  assert({ actual, expect });
}

{
  const actual = humanize(Infinity);
  const expect = "Infinity";
  assert({ actual, expect });
}

{
  const actual = humanize(-Infinity);
  const expect = "-Infinity";
  assert({ actual, expect });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new Number(0));
  const expect = "Number(0)";
  assert({ actual, expect });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new Number(0), { parenthesis: true });
  const expect = "(Number(0))";
  assert({ actual, expect });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new Number(0), { useNew: true });
  const expect = "new Number(0)";
  assert({ actual, expect });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new Number(0), { parenthesis: true, useNew: true });
  const expect = "new (Number(0))";
  assert({ actual, expect });
}

// numeric separator - numbers
{
  const actual = humanize(1235);
  const expect = "1235";
  assert({ actual, expect });
}

{
  const actual = humanize(67000);
  const expect = "67_000";
  assert({ actual, expect });
}

{
  const actual = humanize(149600000);
  const expect = "149_600_000";
  assert({ actual, expect });
}

{
  const actual = humanize(1_464_301);
  const expect = "1_464_301";
  assert({ actual, expect });
}

// decimal
{
  const actual = humanize(1234.56);
  const expect = "1234.56";
  assert({ actual, expect });
}

{
  const actual = humanize(12345.67);
  const expect = "12_345.67";
  assert({ actual, expect });
}

{
  const actual = humanize(-0.120123);
  const expect = "-0.120123";
  assert({ actual, expect });
}

// negative
{
  const actual = humanize(-1000001);
  const expect = "-1_000_001";
  assert({ actual, expect });
}

// exponential
{
  const actual = humanize(-1.23456e105);
  const expect = "-1.23456e+105";
  assert({ actual, expect });
}

{
  const actual = humanize(-1200000e5);
  const expect = "-120_000_000_000";
  assert({ actual, expect });
}

{
  // prettier-ignore
  const actual = humanize(3.65432E12)
  const expect = "3_654_320_000_000";
  assert({ actual, expect });
}

// numeric separator - binary
{
  const actual = humanize(0b10101010101010);
  const expect = "10_922";
  assert({ actual, expect });
}

{
  // prettier-ignore
  const actual = humanize(0B10101010101010)
  const expect = "10_922";
  assert({ actual, expect });
}

// numeric separator - hexadecimal
{
  const actual = humanize(0xfabf00d);
  const expect = "262_926_349";
  assert({ actual, expect });
}

{
  // prettier-ignore
  const actual = humanize(0xABCDEF)
  // prettier-ignore
  const expect = "11_259_375"
  assert({ actual, expect });
}

// numeric separator - octal
{
  const actual = humanize(0o010101010101);
  const expect = "1_090_785_345";
  assert({ actual, expect });
}

{
  // prettier-ignore
  const actual = humanize(0O010101010101)
  const expect = "1_090_785_345";
  assert({ actual, expect });
}
