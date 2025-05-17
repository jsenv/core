import { snapshotTests } from "@jsenv/snapshot";
import { createResourcePattern } from "@jsenv/url-pattern";

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

  test("1_two_named", () => {
    const pattern = createResourcePattern("/before/:name/name");
    const match = pattern.match("/before/foo/name");
    return {
      match,
    };
  });

  test("2_spaces", () => {
    const pattern = createResourcePattern("/before/:name");
    const name = encodeURIComponent("foo bar");
    const match = pattern.match(`/before/${name}`);
    const generated = pattern.generate({ name: "foo bar" });
    return {
      match,
      generated,
      generatedEncoded: encodeURI(generated),
    };
  });
});
