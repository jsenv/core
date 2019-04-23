import { assert } from "@dmail/assert"
import { findFreePort } from "../findFreePort.js"

const port = await findFreePort()
assert({
  actual: typeof port,
  expected: "number",
})
