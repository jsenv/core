import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = ({ xAlign }) => {
  const number_align = renderTable(
    [
      [
        {
          value: "a long string to see how numbers are aligned",
          border: {},
          xAlign,
        },
      ],
      [{ value: 1234, border: {}, xAlign }],
      [{ value: 234, border: {}, xAlign }],
      [{ value: 12, border: {}, xAlign }],
      // TODO: test with floats
    ],
    { borderCollapse: true, ansi: true },
  );

  console.log(
    renderNamedSections({
      number_align,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test.ONLY(`0_basic`, () => run({}));

  test(`1_x_align_right`, () =>
    run({
      xAlign: "right",
    }));

  test(`2_x_align_center`, () =>
    run({
      xAlign: "center",
    }));
});
