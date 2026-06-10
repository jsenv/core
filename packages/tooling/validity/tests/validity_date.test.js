import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("date type validation", () => {
    const [validity, applyOn] = createValidity({ type: "date" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06-15"': run("2024-06-15"),
      '"2024-02-29"': run("2024-02-29"),
      '"2023-02-29"': run("2023-02-29"),
      '"not-a-date"': run("not-a-date"),
      "timestamp (number)": run(Date.UTC(2024, 5, 15)),
      "invalid type (boolean)": run(true),
    };
  });

  test("date type with min (timestamp)", () => {
    const today = new Date(2024, 5, 15);
    const [validity, applyOn] = createValidity({
      type: "date",
      min: today.getTime(),
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06-15" (today)': run("2024-06-15"),
      '"2024-06-14" (yesterday)': run("2024-06-14"),
      '"2024-06-16" (tomorrow)': run("2024-06-16"),
    };
  });

  test("date type with min and max (string bounds)", () => {
    const [validity, applyOn] = createValidity({
      type: "date",
      min: "2024-01-01",
      max: "2024-12-31",
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06-15"': run("2024-06-15"),
      '"2023-12-31"': run("2023-12-31"),
      '"2025-01-01"': run("2025-01-01"),
    };
  });
});
