import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("float type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "float",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "3.14": run(3.14),
      '"2.5"': run("2.5"),
      '"invalid"': run("invalid"),
    };
  });
});
