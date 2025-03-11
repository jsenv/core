import { countDogs } from "./animals.js";

const animals = ["dog", "dog", "cat", "cat", "cat"];
const actual = countDogs(animals);
const expect = 2;
if (actual !== expect) {
  throw new Error(`countDogs should return ${expect}, got ${actual}`);
}
