import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_four_cells`, () => {
    const none = renderTable([
      [
        { value: "a", border: null },
        { value: "b", border: null },
      ],
      [
        { value: "c", border: null },
        { value: "d", border: null },
      ],
    ]);
    const around_strange = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {}, borderLeft: null },
      ],
      [
        { value: "c", border: {}, borderTop: null },
        { value: "d", border: {}, borderLeft: null },
      ],
    ]);
    const all = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {} },
      ],
      [
        { value: "c", border: {} },
        { value: "d", border: {} },
      ],
    ]);

    const results = {
      none,
      around_strange,
      all,
    };
    console.log(renderNamedSections(results));
  });
});
