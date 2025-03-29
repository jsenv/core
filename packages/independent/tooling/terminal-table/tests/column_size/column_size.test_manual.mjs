import { renderTable } from "@jsenv/terminal-table";

const grid = [
  [{ value: "emoji", border: {} }],
  [{ value: "✅", border: {} }],
  [{ value: "✔️", border: {} }],
];

const output = renderTable(grid, { borderCollapse: true });
console.log(output);
