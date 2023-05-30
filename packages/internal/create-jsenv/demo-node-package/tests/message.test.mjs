/*
 * This file test the public exports of "jsenv-demo-node"
 * - It illustrates how to test code
 * - It illustrates how to use top level await to test code
 */

import { assert } from "@jsenv/assert";

import { getMessage, getMessageAsync } from "jsenv-demo-node-package";

{
  const actual = getMessage();
  const expected = "Hello dev!";
  assert({ actual, expected });
}

{
  const actual = await getMessageAsync();
  const expected = "Hello dev async!";
  assert({ actual, expected });
}
