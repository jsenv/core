import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

const validityTable = (validity, cases) => {
  const grid = [
    [
      cell("value"),
      cell("valid"),
      cell("valid suggestion"),
      cell("invalid message"),
    ],
    ...cases.map((value) => {
      return [
        cell(humanize(value)),
        cell(validity.valid ? "✓" : "✗"),
        cell(
          validity.validSuggestion
            ? humanize(validity.validSuggestion.value)
            : "-",
        ),
        cell(
          [validity.type, validity.min, validity.max, validity.step]
            .filter(Boolean)
            .join(", ") || "-",
        ),
      ];
    }),
  ];
  return renderTable(grid, { borderCollapse: true });
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("number representations and type", () => {
    const [validityString, applyOnString] = createValidity({
      type: "number",
      representation: "string",
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
        cell("value"),
        cell("representation: string"),
        cell("valid"),
        cell("invalid message"),
      ],
      ...cases.map((value) => {
        applyOnString(value);
        return [
          cell(humanize(value)),
          reprCell(validityString),
          cell(validityString.valid ? "✓" : "✗"),
          cell(validityString.type ?? "-"),
        ];
      }),
    ];

    return renderTable(grid, { borderCollapse: true });
  });

  test("number min", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      representation: "string",
      min: 0,
    });

    const cases = ["-10", "0", "50"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(validity.value !== undefined ? humanize(validity.value) : "-"),
        cell(validity.valid ? "✓" : "✗"),
        cell(
          validity.validSuggestion
            ? humanize(validity.validSuggestion.value)
            : "-",
        ),
        cell(validity.min ?? "-"),
      ];
    });

    return renderTable(
      [
        [
          cell("value"),
          cell("converted"),
          cell("valid"),
          cell("valid suggestion"),
          cell("min error"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("number max", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      representation: "string",
      max: 100,
    });

    const cases = ["50", "100", "150"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(validity.value !== undefined ? humanize(validity.value) : "-"),
        cell(validity.valid ? "✓" : "✗"),
        cell(
          validity.validSuggestion
            ? humanize(validity.validSuggestion.value)
            : "-",
        ),
        cell(validity.max ?? "-"),
      ];
    });

    return renderTable(
      [
        [
          cell("value"),
          cell("converted"),
          cell("valid"),
          cell("valid suggestion"),
          cell("max error"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("number step", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      representation: "string",
      step: 0.1,
    });

    const cases = ["1.2", "1.23", "3.000001", "3.05", "2.67"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(validity.value !== undefined ? humanize(validity.value) : "-"),
        cell(validity.valid ? "✓" : "✗"),
        cell(
          validity.validSuggestion
            ? humanize(validity.validSuggestion.value)
            : "-",
        ),
        cell(validity.step ?? "-"),
      ];
    });

    return renderTable(
      [
        [
          cell("value"),
          cell("converted"),
          cell("valid"),
          cell("valid suggestion"),
          cell("step error"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });
});
