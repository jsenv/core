import { assert } from "@dmail/assert"
import { serviceCompose } from "../serviceCompose.js"

serviceCompose(() => null, (a) => a)({ a: true }).then((response) => {
  assert({ actual: response, expected: { a: true } })
})
