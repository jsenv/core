import { getRuntimeName } from "../getRuntimeName.js"

const actual = typeof getRuntimeName()
const expected = "string"
if (actual !== expected) {
  throw new Error(`getRuntimeName must return a string, got ${actual}`)
}
