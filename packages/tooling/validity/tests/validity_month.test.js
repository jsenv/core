import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("month type validation", () => {
    const [validity, applyOn] = createValidity({ type: "month" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06"': run("2024-06"),
      '"2024-13"': run("2024-13"),
      '"2024-00"': run("2024-00"),
      '"not-a-month"': run("not-a-month"),
      "timestamp (number)": run(Date.UTC(2024, 5, 1)),
    };
  });

  test("month type with min (timestamp)", () => {
    const thisMonth = new Date(2024, 5, 1);
    const [validity, applyOn] = createValidity({
      type: "month",
      min: thisMonth.getTime(),
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06" (this month)': run("2024-06"),
      '"2024-05" (last month)': run("2024-05"),
      '"2024-07" (next month)': run("2024-07"),
    };
  });
});
