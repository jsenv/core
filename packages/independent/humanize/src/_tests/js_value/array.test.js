import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize([]);
  const expected = `[]`;
  assert({ actual, expected });
}

{
  const actual = humanize([[]]);
  const expected = `[
  []
]`;
  assert({ actual, expected });
}

{
  const actual = humanize(Array(3));
  // prettier-ignore
  const expected = `[
  ,
  ,
${"  "}
]`
  assert({ actual, expected });
}

{
  const actual = humanize([Symbol()]);
  const expected = `[
  Symbol()
]`;
  assert({ actual, expected });
}

{
  // eslint-disable-next-line no-array-constructor
  const newArray = new Array("foo", 1);

  {
    const actual = humanize(newArray);
    const expected = `[
  "foo",
  1
]`;
    assert({
      actual,
      expected,
    });
  }

  {
    const actual = humanize(newArray);
    const expected = `[
  "foo",
  1
]`;
    assert({ actual, expected });
  }
}

{
  const circularArray = [0];
  circularArray.push(circularArray);
  const actual = humanize(circularArray);
  const expected = `[
  0,
  Symbol.for('circular')
]`;
  assert({ actual, expected });
}
