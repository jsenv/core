import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("datetime type validation", () => {
    const [validity, applyOn] = createValidity({ type: "datetime" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06-15T14:30:00Z"': run("2024-06-15T14:30:00Z"),
      '"2024-06-15"': run("2024-06-15"),
      '"not a datetime"': run("not a datetime"),
      "timestamp (number)": run(Date.UTC(2024, 5, 15, 14, 30)),
      "Date instance": run(new Date(2024, 5, 15, 14, 30)),
    };
  });

  test("datetime type with min and max (timestamps)", () => {
    const minTs = new Date(2024, 5, 15, 9, 0).getTime();
    const maxTs = new Date(2024, 5, 15, 18, 0).getTime();
    const [validity, applyOn] = createValidity({
      type: "datetime",
      min: minTs,
      max: maxTs,
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "within range": run(new Date(2024, 5, 15, 12, 0).getTime()),
      "before min": run(new Date(2024, 5, 15, 8, 0).getTime()),
      "after max": run(new Date(2024, 5, 15, 19, 0).getTime()),
    };
  });
});
