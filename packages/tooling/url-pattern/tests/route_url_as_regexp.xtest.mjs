import { snapshotTests } from "@jsenv/snapshot";
import { createResourcePattern } from "../src/resource_pattern.js";

const convertPatternIntoRegexp = (pattern) =>
  createResourcePattern(pattern).regexp;

await snapshotTests(import.meta.url, ({ test }) => {
  test("id_at_end", () => convertPatternIntoRegexp("/before/:id"));

  test("id_at_start", () => convertPatternIntoRegexp("/:id/after"));

  test("id_in_the_middle", () => convertPatternIntoRegexp("/before/:id/after"));

  test("two_in_the_middle", () =>
    convertPatternIntoRegexp("/before/:id/:name/after"));
});
