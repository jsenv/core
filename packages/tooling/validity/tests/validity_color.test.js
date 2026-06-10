import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("color type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "color",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"#FF0000"': run("#FF0000"),
      '"#f0a"': run("#f0a"),
      '"rgb(255, 128, 0)"': run("rgb(255, 128, 0)"),
      '"rgba(255, 128, 0, 0.5)"': run("rgba(255, 128, 0, 0.5)"),
      '"red"': run("red"),
      '"Blue"': run("Blue"),
      '"#GGGGGG"': run("#GGGGGG"),
      '"rgb(300, 128, 0)"': run("rgb(300, 128, 0)"),
    };
  });
});
