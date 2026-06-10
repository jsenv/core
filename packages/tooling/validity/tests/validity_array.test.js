import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("array type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "array",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "[1, 2, 3]": run([1, 2, 3]),
      "[]": run([]),
      '{ key: "value" }': run({ key: "value" }),
      '"[1,2,3]"': run("[1,2,3]"),
      '"not an array"': run("not an array"),
    };
  });
});
