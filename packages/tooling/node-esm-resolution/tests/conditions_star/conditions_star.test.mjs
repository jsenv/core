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
  test("0_dev_star", () => {
    return run({
      conditions: ["dev:*", "import"],
    });
  });

  test("1_import", () => {
    return run({
      conditions: ["import"],
    });
  });
});
