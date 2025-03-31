import { renderTable } from "@jsenv/terminal-table";

const table = renderTable(
  [
    [
      {
        value: "cell",
        border: {},
      },
    ],
  ],
  {
    ansi: true,
    borderSpacing: 1,
  },
);
console.log(table);
