import { renderTable } from "@jsenv/terminal-table";

const table = renderTable([
  [
    {
      value: "cell",
      border: { spacingLeft: 1, spacingRight: 1 },
    },
  ],
]);
console.log(table);
