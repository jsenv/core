import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("longitude type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "longitude",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "45.5": run(45.5),
      "0": run(0),
      "-179.9": run(-179.9),
      "200": run(200),
      "-200": run(-200),
      '"125.5"': run("125.5"),
    };
  });

  test("step validation with string inputs (longitude type)", () => {
    const [validity, applyOn] = createValidity({
      type: "longitude",
      step: 0.1,
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "3.000001": run("3.000001"),
      "2.67": run("2.67"),
      "-179.95": run("-179.95"),
      "3.05": run("3.05"),
    };
  });

  test("an other step validation", () => {
    const [validity, applyOn] = createValidity({
      type: "longitude",
      step: 0.000001,
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      48.8666669999999: run("48.86666699999998"),
    };
  });
});
