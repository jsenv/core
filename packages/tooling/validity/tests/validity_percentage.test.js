import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("percentage type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "percentage",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"50%"': run("50%"),
      '"50"': run("50"),
      '"150%"': run("150%"),
      "75": run(75),
    };
  });
});
