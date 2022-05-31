import { countDogs } from "./animals.js"

const animals = ["dog", "dog", "cat", "cat", "cat"]
const actual = countDogs(animals)
const expected = 2
if (actual !== expected) {
  throw new Error(`countDogs should return ${expected}, got ${actual}`)
}
