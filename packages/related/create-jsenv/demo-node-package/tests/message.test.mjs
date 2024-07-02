/*
 * This file test the public exports of "jsenv-demo-node"
 * - It illustrates how to test code
 * - It illustrates how to use top level await to test code
 */

import { assert } from "@jsenv/assert";

import { getMessage, getMessageAsync } from "jsenv-demo-node-package";

{
  const actual = getMessage();
  const expect = "Hello dev!";
  assert({ actual, expect });
}

{
  const actual = await getMessageAsync();
  const expect = "Hello dev async!";
  assert({ actual, expect });
}
