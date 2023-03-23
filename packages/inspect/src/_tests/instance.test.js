import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

const CustomConstructor = function () {
  this.foo = true
}
const customInstance = new CustomConstructor()
const actual = inspect(customInstance)
const expected = `CustomConstructor({
  "foo": true
})`
assert({ actual, expected })
