import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

await snapshotTests(import.meta.url, ({ test }) => {
  test("email type validation", () => {
    const [validity, applyOn] = createValidity({
  "type": "email"
});

    const cases = ["user@example.com","test@domain.org","invalid-email","@domain.com","user@",undefined];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.representations.valid?.value)),
        cell(humanize(validity.type)),
      ];
    });

    return renderTable(
      [
        [
          cell("input"),
          cell(".value"),
          cell(".valid"),
          cell(".representations.valid.value"),
          cell(".type"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });
});
