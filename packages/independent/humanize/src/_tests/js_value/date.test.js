import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(new Date(10));
  const expect = `Date(10)`;
  assert({ actual, expect });
}

{
  const nowMs = Date.now();
  const actual = humanize(new Date(nowMs));
  const expect = `Date(${nowMs})`;
  assert({ actual, expect });
}
