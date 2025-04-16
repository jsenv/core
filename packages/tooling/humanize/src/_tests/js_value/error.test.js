import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(new Error("here"));
  const expect = `Error("here")`;
  assert({ actual, expect });
}

{
  const actual = humanize(new RangeError("here"));
  const expect = `RangeError("here")`;
  assert({ actual, expect });
}

{
  const actualError = new Error("hello");
  Object.defineProperty(actualError, "bar", {
    enumerable: false,
    value: "bar",
  });
  const actual = humanize(actualError);
  const expect = `Error("hello")`;
  assert({ actual, expect });
}

{
  const error = new Error();
  error.name = "AssertionError";
  const actual = humanize(error);
  const expect = `Error("")`;
  assert({ actual, expect });
}
