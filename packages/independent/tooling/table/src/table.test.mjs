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
  test("0_one_cell_all_border", () => {
    return run([
      [
        {
          value: "1",
          ...borderAllAround,
        },
      ],
    ]);
  });

  test("1_one_cell_border_top", () => {
    return run([
      [
        {
          value: "1",
          borderTop: {},
        },
      ],
    ]);
  });

  test("1_one_cell_border_top_and_left", () => {
    return run([
      [
        {
          value: "1",
          borderTop: {},
          borderLeft: {},
        },
      ],
    ]);
  });

  // test.ONLY("2_two_lines", () => {
  //   return run([
  //     [{ value: "1", ...borderAllAround }],
  //     [{ value: "2", ...borderAllAround }],
  //   ]);
  // });
});

// test(`
//     ┌─────────┐
//     │ (index) │
//     ├─────────┤
//     │ 0       │
//     │ 1       │
//     └─────────┘`);
