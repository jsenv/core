import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("minute type validation", () => {
    const [validity, applyOn] = createValidity({ type: "minute" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "30": run(30),
      "90": run(90),
      "-5 (below min)": run(-5),
      "1.5 (not integer)": run(1.5),
      '"45" (string number)': run("45"),
      "true (invalid type)": run(true),
    };
  });

  test("minute type with max", () => {
    const [validity, applyOn] = createValidity({ type: "minute", max: 59 });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "59": run(59),
      "60 (above max)": run(60),
    };
  });
});
