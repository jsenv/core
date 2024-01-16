import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

// const arrowFunctionSupported = (() => {}).prototype === null

{
  const actual = humanize(function () {});
  const expected = `function () {/* hidden */}`;
  assert({ actual, expected });
}

{
  const actual = humanize(function () {}, { showFunctionBody: true });
  const expected = "function () {}";
  assert({ actual, expected });
}

{
  const value = function () {
    return true;
  };
  const actual = humanize(value, { showFunctionBody: true });
  const expected = value.toString();
  assert({ actual, expected });
}

function named(a) {
  return a;
}
{
  const actual = humanize(named);
  const expected = `function named() {/* hidden */}`;
  assert({ actual, expected });
}
{
  const actual = humanize(named, { showFunctionBody: true });
  const expected = named.toString();
  assert({ actual, expected });
}

{
  const nested = {
    // eslint-disable-next-line object-shorthand
    function: function () {},
  };
  const actual = humanize(nested);
  const expected = `{
  "function": function () {/* hidden */}
}`;
  assert({ actual, expected });
}
