import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { renderTable, tableFromObjects } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("boolean type conversion", () => {
    const [validity, applyOn] = createValidity({
      type: "boolean",
    });

    const rows = [];
    const run = (value) => {
      applyOn(value);
      const message = validity.valid ? "-" : validity.type;
      const suggestion = validity.validSuggestion
        ? humanize(validity.validSuggestion.value)
        : "-";
      rows.push({ value: humanize(value), message, suggestion });
    };

    run(true);
    run("true");
    run("false");
    run(1);

    return renderTable(
      tableFromObjects(rows, {
        head: [
          { value: "value" },
          { value: "invalid message" },
          { value: "valid suggestion" },
        ],
      }),
    );
  });
});
