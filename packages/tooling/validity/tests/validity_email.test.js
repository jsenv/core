import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("email type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "email",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"user@example.com"': run("user@example.com"),
      '"test@domain.org"': run("test@domain.org"),
      '"invalid-email"': run("invalid-email"),
      '"@domain.com"': run("@domain.com"),
      '"user@"': run("user@"),
    };
  });
});
