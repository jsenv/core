import { assert } from "/node_modules/@dmail/assert/index.js"
import { serviceCompose } from "./serviceCompose.js"

serviceCompose(() => null, (a) => a)({ a: true }).then((response) => {
  assert({ actual: response, expected: { a: true } })
})
