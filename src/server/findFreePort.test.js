import { test } from "@dmail/test"
import assert from "assert"
import { findFreePort } from "./findFreePort.js"

test(() => {
  return findFreePort().then((port) => {
    assert.equal(typeof port, "number")
  })
})
