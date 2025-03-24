import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_nine_cells`, () => {
    const none = renderTable([
      [
        { value: "a", border: null },
        { value: "b", border: null },
        { value: "c", border: null },
      ],
      [
        { value: "d", border: null },
        { value: "e", border: null },
        { value: "f", border: null },
      ],
      [
        { value: "g", border: null },
        { value: "h", border: null },
        { value: "i", border: null },
      ],
    ]);
    const center_only = renderTable([
      [
        { value: "a", border: null },
        { value: "b", border: null },
        { value: "c", border: null },
      ],
      [
        { value: "d", border: null },
        { value: "e", border: {} },
        { value: "f", border: null },
      ],
      [
        { value: "g", border: null },
        { value: "h", border: null },
        { value: "i", border: null },
      ],
    ]);
    const bottom_right_only = renderTable([
      [
        { value: "a", border: null },
        { value: "b", border: null },
        { value: "c", border: null },
      ],
      [
        { value: "d", border: null },
        { value: "e", border: null },
        { value: "f", border: null },
      ],
      [
        { value: "g", border: null },
        { value: "h", border: null },
        { value: "i", border: {} },
      ],
    ]);
    const all = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {} },
        { value: "c", border: {} },
      ],
      [
        { value: "d", border: {} },
        { value: "e", border: {} },
        { value: "f", border: {} },
      ],
      [
        { value: "g", border: {} },
        { value: "h", border: {} },
        { value: "i", border: {} },
      ],
    ]);

    console.log(
      renderNamedSections({
        none,
        center_only,
        bottom_right_only,
        all,
      }),
    );
  });
});
