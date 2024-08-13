import { assert } from "@jsenv/assert";
import { median } from "@jsenv/performance-impact/src/internal/median.js";

{
  const numbers = [102.344125, 104.741811, 100.027091, 103.003714, 105.492454];
  const actual = median(numbers);
  const expect = 103.003714;
  assert({ actual, expect });
}
