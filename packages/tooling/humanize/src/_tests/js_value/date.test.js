import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(new Date(10));
  const expect = `Date("1970-01-01T00:00:00.010Z")`;
  assert({ actual, expect });
}
