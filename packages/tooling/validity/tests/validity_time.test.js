import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("time type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "time",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"14:30"': run("14:30"),
      '"09:15:30"': run("09:15:30"),
      '"23:59:59"': run("23:59:59"),
      '"24:00"': run("24:00"),
      '"14:60"': run("14:60"),
      '"2:30 PM"': run("2:30 PM"),
    };
  });
});
