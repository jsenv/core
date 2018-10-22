import { serviceCompose } from "./serviceCompose.js"
import assert from "assert"

serviceCompose(() => null, (a) => a)({ a: true }).then((response) => {
  assert.deepEqual(response, { a: true })
})
