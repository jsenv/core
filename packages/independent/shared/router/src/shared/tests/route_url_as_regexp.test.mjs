import { snapshotTests } from "@jsenv/snapshot";
import { parseResourcePattern } from "../resource_pattern.js";

const convertPatternIntoRegexp = (pattern) =>
  parseResourcePattern(pattern).regexp;

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_id_at_end", () => convertPatternIntoRegexp("/before/:id"));

  test("1_id_at_start", () => convertPatternIntoRegexp("/:id/after"));

  test("2_id_in_the_middle", () =>
    convertPatternIntoRegexp("/before/:id/after"));

  test("3_two_in_the_middle", () =>
    convertPatternIntoRegexp("/before/:id/:name/after"));
});
