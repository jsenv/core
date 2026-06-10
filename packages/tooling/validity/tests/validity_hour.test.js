import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("hour type validation", () => {
    const [validity, applyOn] = createValidity({ type: "hour" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "12": run(12),
      "-1 (below min)": run(-1),
      "1.5 (not integer)": run(1.5),
      '"3" (string number)': run("3"),
      "true (invalid type)": run(true),
    };
  });

  test("hour type with max", () => {
    const [validity, applyOn] = createValidity({ type: "hour", max: 23 });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "23": run(23),
      "24 (above max)": run(24),
    };
  });
});
