import { writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { renderTerminalSvg } from "@jsenv/terminal-recorder";
import { renderTable } from "@jsenv/terminal-table";

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
run();

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    run();
  });
});
