import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("object type with JSON conversion", () => {
    const [validity, applyOn] = createValidity({
      type: "object",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '{ key: "value" }': run({ key: "value" }),
      '"{\"key\": \"value\"}"': run('{"key": "value"}'),
      '"{invalid json}"': run("{invalid json}"),
    };
  });
});
