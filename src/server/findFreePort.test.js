import { assert } from "@dmail/assert"
import { findFreePort } from "./findFreePort.js"

// eslint-disable-next-line import/newline-after-import
;(async () => {
  const port = await findFreePort()
  assert({
    actual: typeof port,
    expected: "number",
  })
})()
