import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(true);
  const expected = "true";
  assert({ actual, expected });
}

{
  const actual = humanize(false);
  const expected = "false";
  assert({ actual, expected });
}

/* eslint-disable no-new-wrappers */
{
  const actual = humanize(new Boolean(true));
  const expected = "Boolean(true)";
  assert({ actual, expected });
}

{
  const actual = humanize(new Boolean(true), { parenthesis: true });
  const expected = "(Boolean(true))";
  assert({ actual, expected });
}

{
  const actual = humanize(new Boolean(true), { useNew: true });
  const expected = "new Boolean(true)";
  assert({ actual, expected });
}

{
  const actual = humanize(new Boolean(true), {
    parenthesis: true,
    useNew: true,
  });
  const expected = "new (Boolean(true))";
  assert({
    actual,
    expected,
  });
}
