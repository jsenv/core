import { snapshotTests } from "@jsenv/snapshot";
import { renderTable } from "./table.js";

const run = (lines) => {
  return renderTable(lines);
};

await snapshotTests(import.meta.url, ({ test }) => {
  test.ONLY("0_one_line", () => {
    return run([
      [{ value: "1", borderLeft: {}, borderTop: {}, borderRight: {} }],
    ]);
  });

  test("1_two_lines", () => {
    return run([
      [{ value: "1", borderLeft: {}, borderTop: {}, borderRight: {} }],
      [{ value: "2", borderLeft: {}, borderTop: {}, borderRight: {} }],
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
