import { humanizeDuration } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

snapshotTests.prefConfigure({ preserveDurations: true });
await snapshotTests(import.meta.url, ({ test }) => {
  test("humanizeDuration", () => {
    const cases = [
      0.1, 1.02, 1.52, 52, 55, 99, 999, 1_421, 61_421, 3_601_200, 7_651_200,
    ];
    const grid = [
      [cell("input (ms)"), cell("output"), cell("output (short)")],
      ...cases.map((ms) => [
        cell(String(ms)),
        cell(humanizeDuration(ms)),
        cell(humanizeDuration(ms, { short: true })),
      ]),
    ];
    return renderTable(grid, { borderCollapse: true });
  });
});
