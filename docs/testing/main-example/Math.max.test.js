const actual = Math.max(2, 4)
const expected = 4
if (actual !== expected) {
  throw new Error(`given 2 and 4, Math.max should return ${expected}, got ${actual}`)
}