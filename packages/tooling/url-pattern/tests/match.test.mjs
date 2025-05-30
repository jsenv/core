import { snapshotTests } from "@jsenv/snapshot";
import { createResourcePattern } from "@jsenv/url-pattern";

const run = (resourcePattern, url) => {
  const { match } = createResourcePattern(resourcePattern);
  return match(url);
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => ({
    a: run("/users/:id", "/users/123"),
    d: run("/users/:id", "/users/123/"),
    b: run("/users/:id", "/users"),
    c: run("/users/:id", "/users/"),
    e: run("/?route=a&id=:id", "/?route=a&id=id"),
    f: run("/dir/file.html?route=a/:id", "/dir/file.html?route=a/file.json"),
    g: run("/users/:id/dir/*", `/users/id/dir/a/b`),
  }));
});
