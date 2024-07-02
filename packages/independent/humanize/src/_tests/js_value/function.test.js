import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

// const arrowFunctionSupported = (() => {}).prototype === null

{
  const actual = humanize(function () {});
  const expect = `function () {/* hidden */}`;
  assert({ actual, expect });
}

{
  const actual = humanize(function () {}, { showFunctionBody: true });
  const expect = "function () {}";
  assert({ actual, expect });
}

{
  const value = function () {
    return true;
  };
  const actual = humanize(value, { showFunctionBody: true });
  const expect = value.toString();
  assert({ actual, expect });
}

function named(a) {
  return a;
}
{
  const actual = humanize(named);
  const expect = `function named() {/* hidden */}`;
  assert({ actual, expect });
}
{
  const actual = humanize(named, { showFunctionBody: true });
  const expect = named.toString();
  assert({ actual, expect });
}

{
  const nested = {
    // eslint-disable-next-line object-shorthand
    function: function () {},
  };
  const actual = humanize(nested);
  const expect = `{
  "function": function () {/* hidden */}
}`;
  assert({ actual, expect });
}
