import { snapshotTests } from "@jsenv/snapshot";
import { parseRouteUrl } from "../route_url_parser.js";

const buildRouteUrl = (pattern, url, params) =>
  parseRouteUrl(pattern).build(url, params);

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    return {
      a: buildRouteUrl("/before/:id", "http://example.com/", { id: "test" }),
      b: buildRouteUrl("?route=:route&id=:id", "http://example.com", {
        route: "route_value",
        id: "id_value",
      }),
      c: buildRouteUrl("?paused", "http://example.com/dir/file.js"),
    };
  });
});
