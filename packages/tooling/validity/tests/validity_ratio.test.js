import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("ratio type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "ratio",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "0.5": run(0.5),
      "0": run(0),
      "1": run(1),
      "1.5": run(1.5),
      "-0.5": run(-0.5),
      '"0.75"': run("0.75"),
    };
  });
});
