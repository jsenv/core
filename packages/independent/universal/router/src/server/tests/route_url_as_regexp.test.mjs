import { snapshotTests } from "@jsenv/snapshot";
import { convertRouteUrlIntoRegexp } from "../route_url_as_regexp.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("before_and_after", () =>
    convertRouteUrlIntoRegexp("/before/:id/after"));
});
