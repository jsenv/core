import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

const actual = inspect(undefined)
const expected = "undefined"
assert({ actual, expected })
