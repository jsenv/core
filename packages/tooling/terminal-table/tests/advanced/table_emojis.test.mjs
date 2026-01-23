import { writeFileSync } from "@jsenv/filesystem";
import { renderTerminalSvg } from "@jsenv/terminal-recorder";

import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = () => {
  const table = renderTable(
    [
      [{ value: "emoji", border: {} }],
      [{ value: "✅", border: {} }],
      [{ value: "⚠", border: {} }],
      [{ value: "✔", border: {} }],
      [{ value: "✔️", border: {} }],
      [{ value: "❌", border: {} }],
      [{ value: "♥", border: {} }],
      [{ value: "♀", border: {} }],
      [{ value: "♂", border: {} }],
    ],
    { borderCollapse: true },
  );
  const svg = renderTerminalSvg(table);
  writeFileSync(import.meta.resolve("./table_emojis.svg"), svg);
  console.log(table);
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    run();
  });
});
