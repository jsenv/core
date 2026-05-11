import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { interpolateText } from "../interpolate_text.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value: String(value), border: BORDER });

const table = (rows) => {
  const grid = [["template", "replacements", "result"].map(cell)];
  for (const [template, replacements, result] of rows) {
    grid.push(
      [
        template,
        replacements === null ? "null" : JSON.stringify(replacements),
        result,
      ].map(cell),
    );
  }
  return renderTable(grid, { borderCollapse: true });
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic replacement", () => {
    return table([
      [
        "Hello [name]!",
        { name: "Alice" },
        interpolateText("Hello [name]!", { name: "Alice" }),
      ],
    ]);
  });

  test("no replacements (null)", () => {
    return table([
      ["Hello [name]!", null, interpolateText("Hello [name]!", null)],
    ]);
  });

  test("missing key falls back to placeholder", () => {
    return table([
      [
        "Hello [name]!",
        { other: "x" },
        interpolateText("Hello [name]!", { other: "x" }),
      ],
    ]);
  });

  test("function value", () => {
    return table([
      [
        "Hello [name]!",
        { name: "() => 'Bob'" },
        interpolateText("Hello [name]!", { name: () => "Bob" }),
      ],
      [
        "Hello [name]!",
        { name: "() => ''" },
        interpolateText("Hello [name]!", { name: () => "" }),
      ],
    ]);
  });

  test("dot-notation keys", () => {
    return table([
      [
        "Hello [item.name]",
        '{ "item.name": "toto" }',
        interpolateText("Hello [item.name]", { "item.name": "toto" }),
      ],
      [
        "Hello [item.name]",
        '{ item: { name: "toto" } }',
        interpolateText("Hello [item.name]", { item: { name: "toto" } }),
      ],
      [
        "Hello [item.name]",
        "flat + nested",
        interpolateText("Hello [item.name]", {
          "item.name": "flat",
          "item": { name: "nested" },
        }),
      ],
      [
        "Hello [item.name]",
        "{ item: { age: 42 } }",
        interpolateText("Hello [item.name]", { item: { age: 42 } }),
      ],
      [
        "Hello [item.name]",
        '{ item: "string" }',
        interpolateText("Hello [item.name]", { item: "string" }),
      ],
      [
        "Hello [item.name]",
        '{ item: { name: () => "lazy" } }',
        interpolateText("Hello [item.name]", { item: { name: () => "lazy" } }),
      ],
    ]);
  });
});
