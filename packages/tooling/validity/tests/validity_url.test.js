import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("url type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "url",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"https://example.com"': run("https://example.com"),
      '"http://domain.org/path"': run("http://domain.org/path"),
      '"ftp://files.example.com"': run("ftp://files.example.com"),
      '"not-a-url"': run("not-a-url"),
      '"://missing-protocol.com"': run("://missing-protocol.com"),
    };
  });
});
