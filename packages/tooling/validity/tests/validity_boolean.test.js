import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("boolean type conversion", () => {
    const [validity, applyOn] = createValidity({
      type: "boolean",
    });

    const cell = (value, { color } = {}) => {
      return color ? { value, color } : { value };
    };

    const headerRow = [
      cell("value"),
      cell("invalid message"),
      cell("valid suggestion"),
    ];

    const rows = [headerRow];
    const run = (value) => {
      applyOn(value);
      const messageCell = validity.valid
        ? cell("-")
        : cell(validity.type, { color: "red" });
      let suggestionCell;
      if (validity.valid) {
        suggestionCell = cell("-");
      } else if (validity.validSuggestion) {
        suggestionCell = cell(humanize(validity.validSuggestion.value), {
          color: "green",
        });
      } else {
        suggestionCell = cell("cannot convert", { color: "red" });
      }
      rows.push([cell(humanize(value)), messageCell, suggestionCell]);
    };

    run(true);
    run(false);
    run("true");
    run("false");
    run("on");
    run("1");
    run(1);
    run(0);
    run("toto");
    run(undefined);

    return renderTable(rows);
  });
});
