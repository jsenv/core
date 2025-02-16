import { snapshotTests } from "@jsenv/snapshot";
import { parseRouteUrl } from "../route_url_parser.js";

const buildRouteUrl = (pattern, url, params) =>
  parseRouteUrl(pattern).build(url, params);

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_a", () =>
    buildRouteUrl("/before/:id", "http://example.com/", { id: "test" }));
});
