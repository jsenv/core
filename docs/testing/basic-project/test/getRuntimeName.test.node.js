import { getRuntimeName } from "../getRuntimeName.js"

const actual = getRuntimeName()
const expected = "node"
if (actual !== expected) {
  throw new Error(`getRuntimeName must return ${expected}, got ${actual}`)
}
