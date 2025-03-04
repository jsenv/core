import { snapshotTests } from "@jsenv/snapshot";
import { createResourcePattern } from "../resource_pattern.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    const pattern = createResourcePattern("before/:id/*?url=:url");
    const a = pattern.match("/before/foo/dir/file.js?url=hey");
    return {
      a,
    };
  });
});
