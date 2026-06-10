import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("latitude type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "latitude",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "45.5": run(45.5),
      "0": run(0),
      "-89.9": run(-89.9),
      "100": run(100),
      "-100": run(-100),
      '"45.5"': run("45.5"),
    };
  });
});
