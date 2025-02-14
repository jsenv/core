import { snapshotTests } from "@jsenv/snapshot";
import { routeMatchUrl } from "../route_match_url.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => ({
    a: routeMatchUrl("/users/:id", "/users/123"),
    d: routeMatchUrl("/users/:id", "/users/123/"),
    b: routeMatchUrl("/users/:id", "/users"),
    c: routeMatchUrl("/users/:id", "/users/"),
  }));
});
