import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(new Date(10));
  const expected = `Date(10)`;
  assert({ actual, expected });
}

{
  const nowMs = Date.now();
  const actual = humanize(new Date(nowMs));
  const expected = `Date(${nowMs})`;
  assert({ actual, expected });
}
