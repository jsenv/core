import { assert } from "@jsenv/assert";

import { createCallOrderer } from "@jsenv/test/src/helpers/call_orderer.js";

{
  const orderCall = createCallOrderer();
  const calls = [];
  orderCall(2, () => calls.push("c"));
  orderCall(1, () => calls.push("b"));
  orderCall(0, () => calls.push("a"));
  const actual = calls;
  const expected = ["a", "b", "c"];
  assert({ actual, expected });
}

{
  const orderCall = createCallOrderer();
  const calls = [];
  orderCall(2, () => calls.push("c"));
  orderCall(0, () => calls.push("a"));
  orderCall(1, () => calls.push("b"));
  const actual = calls;
  const expected = ["a", "b", "c"];
  assert({ actual, expected });
}

{
  const orderCall = createCallOrderer();
  const calls = [];
  orderCall(1, () => calls.push("b"));
  orderCall(2, () => calls.push("c"));
  orderCall(0, () => calls.push("a"));
  const actual = calls;
  const expected = ["a", "b", "c"];
  assert({ actual, expected });
}

{
  const orderCall = createCallOrderer();
  const calls = [];
  orderCall(1, () => calls.push("b"));
  orderCall(0, () => calls.push("a"));
  orderCall(2, () => calls.push("c"));
  const actual = calls;
  const expected = ["a", "b", "c"];
  assert({ actual, expected });
}

{
  const orderCall = createCallOrderer();
  const calls = [];
  orderCall(0, () => calls.push("a"));
  orderCall(1, () => calls.push("b"));
  orderCall(2, () => calls.push("c"));
  const actual = calls;
  const expected = ["a", "b", "c"];
  assert({ actual, expected });
}

{
  const orderCall = createCallOrderer();
  const calls = [];
  orderCall(4, () => calls.push("e"));
  orderCall(2, () => calls.push("c"));
  orderCall(0, () => calls.push("a"));
  orderCall(1, () => calls.push("b"));
  orderCall(3, () => calls.push("d"));
  orderCall(5, () => calls.push("f"));
  orderCall(6, () => calls.push("g"));
  orderCall(8, () => calls.push("i"));
  orderCall(7, () => calls.push("h"));
  const actual = calls;
  const expected = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  assert({ actual, expected });
}
