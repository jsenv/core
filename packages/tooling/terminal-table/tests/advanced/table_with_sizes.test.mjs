import { snapshotTests } from "@jsenv/snapshot";
import { renderTable } from "@jsenv/terminal-table";

const run = () => {
  const table = renderTable(
    [
      [
        { value: "size", border: {} },
        { value: "percentage", border: {} },
      ],
      [
        { value: 10, border: {}, format: "size" },
        { value: 10, border: {}, format: "percentage", unit: "%" },
      ],
      [
        { value: 1000, border: {}, format: "size" },
        { value: 90, border: {}, format: "percentage", unit: "%" },
      ],
    ],
    { borderCollapse: true },
  );
  console.log(table);
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    run();
  });
});
