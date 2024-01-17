import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(/ok/g);
  const expected = "/ok/g";
  assert({ actual, expected });
}

{
  const actual = humanize(new RegExp("foo", "g"));
  const expected = "/foo/g";
  assert({ actual, expected });
}
