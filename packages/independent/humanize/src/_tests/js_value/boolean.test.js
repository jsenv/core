import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(true);
  const expect = "true";
  assert({ actual, expect });
}

{
  const actual = humanize(false);
  const expect = "false";
  assert({ actual, expect });
}

/* eslint-disable no-new-wrappers */
{
  const actual = humanize(new Boolean(true));
  const expect = "Boolean(true)";
  assert({ actual, expect });
}

{
  const actual = humanize(new Boolean(true), { parenthesis: true });
  const expect = "(Boolean(true))";
  assert({ actual, expect });
}

{
  const actual = humanize(new Boolean(true), { useNew: true });
  const expect = "new Boolean(true)";
  assert({ actual, expect });
}

{
  const actual = humanize(new Boolean(true), {
    parenthesis: true,
    useNew: true,
  });
  const expect = "new (Boolean(true))";
  assert({
    actual,
    expect,
  });
}
