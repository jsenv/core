import { humanizeDuration } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

snapshotTests.prefConfigure({ preserveDurations: true });
await snapshotTests(import.meta.url, ({ test }) => {
  test("humanizeDuration", () => {
    const cases = [
      0, 0.1, 1.02, 1.52, 52, 55, 99, 999, 1_421, 59_999, 60_000, 61_421,
      3_599_999, 3_600_000, 3_601_200, 7_200_000, 7_651_200, 86_400_000,
      90_000_000,
    ];
    const grid = [
      [
        cell("input (ms)"),
        cell("output"),
        cell("output (rounded: false)"),
        cell("output (short)"),
      ],
      ...cases.map((ms) => [
        cell(String(ms)),
        cell(humanizeDuration(ms)),
        cell(humanizeDuration(ms, { rounded: false })),
        cell(humanizeDuration(ms, { short: true })),
      ]),
    ];
    return renderTable(grid, { borderCollapse: true });
  });

  test("unit transition progression (seconds→minutes)", () => {
    // Simulate time ticking up as we approach and cross the 1-minute boundary
    const cases = [
      55_000, 59_400, 59_449, 59_450, 59_499, 59_500, 59_501, 59_900, 59_999,
      60_000, 60_001,
    ];
    const grid = [
      [
        cell("input (ms)"),
        cell("output"),
        cell("output (rounded: false)"),
        cell("output (short)"),
      ],
      ...cases.map((ms) => [
        cell(String(ms)),
        cell(humanizeDuration(ms)),
        cell(humanizeDuration(ms, { rounded: false })),
        cell(humanizeDuration(ms, { short: true })),
      ]),
    ];
    return renderTable(grid, { borderCollapse: true });
  });

  test("unit transition progression (minutes→hours)", () => {
    // Same progression but scaled to minutes→hours boundary
    const cases = [
      3_540_000, 3_560_000, 3_570_000, 3_580_000, 3_590_000, 3_595_000,
      3_599_000, 3_599_500, 3_599_900, 3_599_999, 3_600_000, 3_601_000,
      3_602_000,
    ];
    const grid = [
      [
        cell("input (ms)"),
        cell("output"),
        cell("output (rounded: false)"),
        cell("output (short)"),
      ],
      ...cases.map((ms) => [
        cell(String(ms)),
        cell(humanizeDuration(ms)),
        cell(humanizeDuration(ms, { rounded: false })),
        cell(humanizeDuration(ms, { short: true })),
      ]),
    ];
    return renderTable(grid, { borderCollapse: true });
  });

  test("unit transition progression (hours→days)", () => {
    const DAY_MS = 86_400_000;
    const cases = [
      DAY_MS - 3_600_000,
      DAY_MS - 1_800_000,
      DAY_MS - 600_000,
      DAY_MS - 1_000,
      DAY_MS - 500,
      DAY_MS - 1,
      DAY_MS,
      DAY_MS + 1_000,
    ];
    const grid = [
      [
        cell("input (ms)"),
        cell("output"),
        cell("output (rounded: false)"),
        cell("output (short)"),
      ],
      ...cases.map((ms) => [
        cell(String(ms)),
        cell(humanizeDuration(ms)),
        cell(humanizeDuration(ms, { rounded: false })),
        cell(humanizeDuration(ms, { short: true })),
      ]),
    ];
    return renderTable(grid, { borderCollapse: true });
  });
});
