import { snapshotTests } from "@jsenv/snapshot";
import { createResourcePattern } from "../resource_pattern.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    const pattern = createResourcePattern("/before/:id/*?url=:url");
    const match = pattern.match("/before/foo/dir/file.js?url=hey");
    const a = pattern.generate({ id: "foo", url: "bar" }, "/path/to/toto.js");
    return {
      match,
      a,
    };
  });
});
