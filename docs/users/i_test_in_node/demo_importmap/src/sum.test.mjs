import { sum } from "./sum.mjs";

const actual = sum(1, 2);
const expect = 3;
if (actual !== expect) {
  throw new Error(`sum(1,2) should return 3, got ${actual}`);
}
