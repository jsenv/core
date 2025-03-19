import { snapshotTests } from "@jsenv/snapshot";
import { renderTable } from "./table.js";

const run = (table) => {
  return renderTable({
    head: table[0],
    body: table.slice(1),
  });
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    return run([
      [{ value: "1", borderLeft: {}, borderTop: {}, borderRight: {} }],
      [{ value: "2", borderLeft: {}, borderTop: {}, borderRight: {} }],
      [{ value: "3", borderLeft: {}, borderTop: {}, borderRight: {} }],
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
