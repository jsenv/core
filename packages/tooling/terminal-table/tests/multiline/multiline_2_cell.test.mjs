import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = ({ yAlign }) => {
  const render = (left, right) =>
    renderTable(
      [
        [
          { value: left, border: {}, yAlign },
          { value: right, border: {}, yAlign },
        ],
      ],
      {
        ansi: true,
        borderCollapse: true,
      },
    );

  const left_one_right_two = render(
    `a`,
    `a
b`,
  );

  const left_two_right_one = render(
    `a
b`,
    `a`,
  );

  const left_three_right_five = render(
    `a
b
c`,
    `a
b
c
d
e`,
  );

  console.log(
    renderNamedSections({
      left_one_right_two,
      left_two_right_one,
      left_three_right_five,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));

  test(`1_y_align_end`, () =>
    run({
      yAlign: "end",
    }));

  test(`2_y_align_center`, () =>
    run({
      yAlign: "center",
    }));
});
