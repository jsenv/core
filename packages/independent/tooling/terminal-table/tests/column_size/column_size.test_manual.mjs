import { renderTable } from "@jsenv/terminal-table";

const grid = [
  [{ value: "emoji", border: {} }],
  [{ value: "✅", border: {} }],
  [{ value: "✔️", border: {} }],
];

console.log(renderTable(grid, { borderCollapse: true }));
