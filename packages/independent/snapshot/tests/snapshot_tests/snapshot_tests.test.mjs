import { snapshotTests } from "@jsenv/snapshot";

await snapshotTests(
  ({ test }) => {
    test("something", () => {
      console.log("hello");
    });
  },
  new URL("./output/basic.md", import.meta.url),
);
