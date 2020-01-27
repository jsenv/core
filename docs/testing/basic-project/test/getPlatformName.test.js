import { getPlatformName } from "../getPlatformName.js"

const actual = typeof getPlatformName()
const expected = "string"
if (actual !== expected) {
  throw new Error(`getPlatformName must return a string, got ${actual}`)
}
