import { snapshotTests } from "@jsenv/snapshot";
import { renderTable } from "./table.js";

const run = (lines) => {
  return renderTable(lines);
};

const borderAllAround = {
  borderLeft: {},
  borderTop: {},
  borderRight: {},
  borderBottom: {},
};

await snapshotTests(import.meta.url, ({ test }) => {
  test.ONLY("0_one_line", () => {
    return run([
      [
        {
          value: "1",
          ...borderAllAround,
        },
      ],
    ]);
  });

  test("1_two_lines", () => {
    return run([
      [{ value: "1", ...borderAllAround }],
      [{ value: "2", ...borderAllAround }],
    ]);
  });
});

// test(`
//     ┌─────────┐
//     │ (index) │
//     ├─────────┤
//     │ 0       │
//     │ 1       │
//     └─────────┘`);
