import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("oneOf validation", () => {
    const [validity, applyOn] = createValidity({
      oneOf: ["red", "green", "blue"],
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"red"': run("red"),
      '"yellow"': run("yellow"),
    };
  });
});
