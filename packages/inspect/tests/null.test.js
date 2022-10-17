import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

const actual = inspect(null)
const expected = "null"
assert({ actual, expected })
