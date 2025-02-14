import { snapshotTests } from "@jsenv/snapshot";
import { convertRouteUrlIntoRegexp } from "../route_url_as_regexp.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_id_at_end", () => convertRouteUrlIntoRegexp("/before/:id"));

  test("1_id_at_start", () => convertRouteUrlIntoRegexp("/:id/after"));

  test("2_id_in_the_middle", () =>
    convertRouteUrlIntoRegexp("/before/:id/after"));

  test("3_two_in_the_middle", () =>
    convertRouteUrlIntoRegexp("/before/:id/:name/after"));
});
