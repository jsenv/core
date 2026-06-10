import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("second type validation", () => {
    const [validity, applyOn] = createValidity({ type: "second" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "30": run(30),
      "-1 (below min)": run(-1),
      "1.5 (not integer)": run(1.5),
      '"10" (string number)': run("10"),
      "true (invalid type)": run(true),
    };
  });

  test("second type with max and decimal step", () => {
    const [validity, applyOn] = createValidity({
      type: "second",
      max: 59,
      step: 0.5,
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "30.5": run(30.5),
      "30.3 (invalid step)": run(30.3),
      "60 (above max)": run(60),
    };
  });
});
