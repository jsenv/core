import { sum } from "./sum.mjs"

const actual = sum(1, 2)
const expected = 3
if (actual !== expected) {
  throw new Error(`sum(1,2) should return 3, got ${actual}`)
}
