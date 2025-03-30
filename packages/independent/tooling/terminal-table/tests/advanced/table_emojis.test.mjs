import { writeFileSync } from "@jsenv/filesystem";
import { renderTerminalSvg } from "@jsenv/terminal-recorder";
import { renderTable } from "@jsenv/terminal-table";

const table = renderTable(
  [
    [{ value: "emoji", border: {} }],
    [{ value: "✅", border: {} }],
    [{ value: "⚠", border: {} }],
    [{ value: "✔", border: {} }],
  ],
  { borderCollapse: true },
);
const svg = renderTerminalSvg(table);
writeFileSync(import.meta.resolve("./table_emojis.svg"), svg);
