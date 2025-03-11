import { snapshotTests } from "@jsenv/snapshot";
import { routeMatchUrl } from "../route_match_url.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => ({
    a: routeMatchUrl("/users/:id", "/users/123"),
    d: routeMatchUrl("/users/:id", "/users/123/"),
    b: routeMatchUrl("/users/:id", "/users"),
    c: routeMatchUrl("/users/:id", "/users/"),
    e: routeMatchUrl("/?route=a&id=:id", "/?route=a&id=id"),
    f: routeMatchUrl(
      "/dir/file.html?route=a/:id",
      "/dir/file.html?route=a/file.json",
    ),
    g: routeMatchUrl("/users/:id/dir/*", `/users/id/dir/a/b`),
  }));
});
