import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("integer type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "integer",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "42": run(42),
      "3.14": run(3.14),
      '"123"': run("123"),
      '"3.7"': run("3.7"),
    };
  });
});
