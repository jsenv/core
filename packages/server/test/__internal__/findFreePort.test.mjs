import { assert } from "@jsenv/assert"

import { findFreePort } from "@jsenv/server"

const port = await findFreePort()

const actual = typeof port
const expected = "number"
assert({ actual, expected })
