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
      customRepresentation: "string",
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
          reprCell(validityString.representations.custom),
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
      customRepresentation: "string",
      min: 0,
    });

    const cases = ["-10", "0", "50"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(
          validity.representations?.custom !== undefined
            ? humanize(validity.representations.custom)
            : "-",
        ),
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
      customRepresentation: "string",
      max: 100,
    });

    const cases = ["50", "100", "150"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(
          validity.representations?.custom !== undefined
            ? humanize(validity.representations.custom)
            : "-",
        ),
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
      customRepresentation: "string",
      step: 0.1,
    });

    const cases = ["1.2", "1.23", "3.000001", "3.05", "2.67"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(
          validity.representations?.custom !== undefined
            ? humanize(validity.representations.custom)
            : "-",
        ),
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

  test("number step integer", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      customRepresentation: "string",
      step: 1,
    });

    const cases = ["5", "5.5"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(
          validity.representations?.custom !== undefined
            ? humanize(validity.representations.custom)
            : "-",
        ),
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

  test("number combined min max step", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      customRepresentation: "string",
      min: 0,
      max: 10,
      step: 0.5,
    });

    const cases = ["5.5", "-2.3"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(
          validity.representations?.custom !== undefined
            ? humanize(validity.representations.custom)
            : "-",
        ),
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
    });

    return renderTable(
      [
        [
          cell("value"),
          cell("converted"),
          cell("valid"),
          cell("valid suggestion"),
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
      customRepresentation: "string",
      min: 0,
      max: 100,
      step: 1,
    });

    const cases = ["150", "5.5", "-10", "50"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(
          validity.representations?.custom !== undefined
            ? humanize(validity.representations.custom)
            : "-",
        ),
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
    });

    return renderTable(
      [
        [
          cell("value"),
          cell("converted"),
          cell("valid"),
          cell("valid suggestion"),
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
        cell(validity.valid ? "✓" : "✗"),
        cell(
          validity.validSuggestion
            ? humanize(validity.validSuggestion.value)
            : "-",
        ),
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
          cell("value"),
          cell("valid"),
          cell("valid suggestion"),
          cell("errors"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });
});
