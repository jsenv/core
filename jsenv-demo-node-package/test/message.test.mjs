/*
 * This file test the public exports of "jsenv-demo-node"
 * - It illustrates how to test code
 * - It illustrates how to use top level await to test code
 */

import { assert } from "@jsenv/assert"

import { getMessageAsync } from "jsenv-demo-node-package"

const messageExpected = "Hello dev!"

{
  const actual = await getMessageAsync()
  const expected = messageExpected
  assert({ actual, expected })
}
