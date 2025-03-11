import { ask } from "./file.js"

const actual = ask()
const expected = 42
if (actual !== expected) {
  throw new Error(`ask() should return ${expected}, got ${actual}`)
}
