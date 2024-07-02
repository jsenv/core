import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize([]);
  const expect = `[]`;
  assert({ actual, expect });
}

{
  const actual = humanize([[]]);
  const expect = `[
  []
]`;
  assert({ actual, expect });
}

{
  const actual = humanize(Array(3));
  // prettier-ignore
  const expect = `[
  ,
  ,
${"  "}
]`
  assert({ actual, expect });
}

{
  const actual = humanize([Symbol()]);
  const expect = `[
  Symbol()
]`;
  assert({ actual, expect });
}

{
  // eslint-disable-next-line no-array-constructor
  const newArray = new Array("foo", 1);

  {
    const actual = humanize(newArray);
    const expect = `[
  "foo",
  1
]`;
    assert({
      actual,
      expect,
    });
  }

  {
    const actual = humanize(newArray);
    const expect = `[
  "foo",
  1
]`;
    assert({ actual, expect });
  }
}

{
  const circularArray = [0];
  circularArray.push(circularArray);
  const actual = humanize(circularArray);
  const expect = `[
  0,
  Symbol.for('circular')
]`;
  assert({ actual, expect });
}
