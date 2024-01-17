import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(new Error("here"));
  const expected = `Error("here")`;
  assert({ actual, expected });
}

{
  const actual = humanize(new RangeError("here"));
  const expected = `RangeError("here")`;
  assert({ actual, expected });
}

{
  const actualError = new Error("hello");
  Object.defineProperty(actualError, "bar", {
    enumerable: false,
    value: "bar",
  });
  const actual = humanize(actualError);
  const expected = `Error("hello")`;
  assert({ actual, expected });
}

{
  const error = new Error();
  error.name = "AssertionError";
  const actual = humanize(error);
  const expected = `Error("")`;
  assert({ actual, expected });
}
