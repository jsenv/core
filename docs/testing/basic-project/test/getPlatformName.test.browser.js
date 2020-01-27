import { getPlatformName } from "../getPlatformName.js"

const actual = getPlatformName()
const expected = "browser"
if (actual !== expected) {
  throw new Error(`getPlatformName must return ${expected}, got ${actual}`)
}
