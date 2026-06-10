import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

await snapshotTests(import.meta.url, ({ test }) => {
  test("number representations and type", () => {
    const [validityString, applyOnString] = createValidity({
      type: "number",
      representation: { string: "string" },
    });

    const cases = [
      42,
      3.14,
      "123",
      "3.14",
      "not a number",
      Infinity,
      undefined,
    ];

    const reprCell = (v) => {
      return cell(
        v.value !== undefined ? humanize(v.value) : "[[CANNOT_CONVERT]]",
      );
    };

    const grid = [
      [
        cell("input"),
        cell(".representations.string.value"),
        cell(".valid"),
        cell(".type"),
      ],
      ...cases.map((value) => {
        applyOnString(value);
        return [
          cell(humanize(value)),
          reprCell(validityString.representations.string),
          cell(humanize(validityString.valid)),
          cell(humanize(validityString.type)),
        ];
      }),
    ];

    return renderTable(grid, { borderCollapse: true });
  });

  test("number min", () => {
    const cases = ["-10", "0", "50"];

    const makeRow = (validity, applyOn, value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.autoFixed)),
        cell(humanize(validity.representations.valid?.value)),
        cell(
          validity.representations.string
            ? humanize(validity.representations.string.value)
            : "-",
        ),
        cell(humanize(validity.min)),
      ];
    };
    const headers = [
      cell("input"),
      cell(".value"),
      cell(".valid"),
      cell(".autoFixed"),
      cell(".representations.valid.value"),
      cell(".representations.string.value"),
      cell(".min"),
    ];

    const [validity, applyOn] = createValidity({
      type: "number",
      representation: { string: "string" },
      min: 0,
    });
    const table1 = renderTable(
      [headers, ...cases.map((value) => makeRow(validity, applyOn, value))],
      { borderCollapse: true },
    );

    const [validityAutoFix, applyOnAutoFix] = createValidity({
      type: "number",
      representation: { string: "string" },
      min: 0,
      autoFix: true,
    });
    const table2 = renderTable(
      [
        headers,
        ...cases.map((value) =>
          makeRow(validityAutoFix, applyOnAutoFix, value),
        ),
      ],
      { borderCollapse: true },
    );

    return `without autoFix:
${table1}

with autoFix: true:
${table2}`;
  });

  test("number max", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      max: 100,
    });

    const cases = [50, 100, 150];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.representations.valid?.value)),
        cell(validity.max ?? "-"),
      ];
    });

    return renderTable(
      [
        [
          cell("input"),
          cell(".valid"),
          cell(".representations.valid.value"),
          cell(".max"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("number step", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      step: 0.1,
    });

    const cases = [1.2, 1.23, 3.000001, 3.05, 2.67];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.representations.valid?.value)),
        cell(validity.step ?? "-"),
      ];
    });

    return renderTable(
      [
        [
          cell("input"),
          cell(".valid"),
          cell(".representations.valid.value"),
          cell(".step"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("number step integer", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      step: 1,
    });

    const cases = [5, 5.5];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.representations.valid?.value)),
        cell(validity.step ?? "-"),
      ];
    });

    return renderTable(
      [
        [
          cell("input"),
          cell(".valid"),
          cell(".representations.valid.value"),
          cell(".step"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("number combined min max step", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      min: 0,
      max: 10,
      step: 0.5,
    });

    const cases = [5.5, -2.3];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.representations.valid?.value)),
        cell(
          [validity.type, validity.min, validity.max, validity.step]
            .filter(Boolean)
            .join(", ") || "-",
        ),
      ];
    });

    return renderTable(
      [
        [
          cell("input"),
          cell(".valid"),
          cell(".representations.valid.value"),
          cell("errors"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("number cross-rule suggestions are validated against all rules", () => {
    // String inputs get converted, then suggestions from one rule are validated against all others
    const [validity, applyOn] = createValidity({
      type: "number",
      min: 0,
      max: 100,
      step: 1,
    });

    const cases = [150, 5.5, -10, 50];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.representations.valid?.value)),
        cell(
          [validity.type, validity.min, validity.max, validity.step]
            .filter(Boolean)
            .join(", ") || "-",
        ),
      ];
    });

    return renderTable(
      [
        [
          cell("input"),
          cell(".valid"),
          cell(".representations.valid.value"),
          cell("errors"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("number impossible constraint oneOf conflicts with min", () => {
    // oneOf values [10, 20, 30] are all below min 50 — no valid suggestion possible
    const [validity, applyOn] = createValidity({
      type: "number",
      oneOf: [10, 20, 30],
      min: 50,
    });

    const cases = [15];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.representations.valid?.value)),
        cell(
          [
            validity.type,
            validity.min,
            validity.max,
            validity.step,
            validity.oneOf,
          ]
            .filter(Boolean)
            .join(", ") || "-",
        ),
      ];
    });

    return renderTable(
      [
        [
          cell("input"),
          cell(".valid"),
          cell(".representations.valid.value"),
          cell("errors"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });
});
