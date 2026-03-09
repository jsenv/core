import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";
import { snapshotTests } from "@jsenv/snapshot";

const run = (params) => {
  const { type, url } = applyNodeEsmResolution({
    parentUrl: import.meta.resolve("./source/index.js"),
    specifier: "#foo",
    ...params,
  });
  return { type, url };
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("dev_star", () => {
    return run({
      conditions: ["dev:*", "import"],
    });
  });

  test("import", () => {
    return run({
      conditions: ["import"],
    });
  });
});
