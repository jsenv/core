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
    const inner_only = renderTable([
      [
        { value: "a", border: {}, borderLeft: null, borderTop: null },
        { value: "b", borderBottom: {} },
        { value: "c", border: {}, borderRight: null, borderTop: null },
      ],
      [
        { value: "d", borderRight: {}, borderBottom: {} },
        { value: "e", borderBottom: {} },
        { value: "f", borderLeft: {}, borderBottom: {} },
      ],
      [
        { value: "g", borderRight: {} },
        { value: "h", border: null },
        { value: "i", borderLeft: {} },
      ],
    ]);
    const head = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", borderTop: {}, borderBottom: {} },
        { value: "c", border: {} },
      ],
      [
        { value: "d", borderLeft: {}, borderRight: {} },
        { value: "e", border: null },
        { value: "f", borderLeft: {}, borderRight: {} },
      ],
      [
        { value: "g", borderLeft: {}, borderBottom: {}, borderRight: {} },
        { value: "h", border: null, borderBottom: {} },
        { value: "i", borderLeft: {}, borderRight: {}, borderBottom: {} },
      ],
    ]);
    const foot = renderTable([
      [
        { value: "a", borderLeft: {}, borderTop: {}, borderRight: {} },
        { value: "b", border: null, borderTop: {} },
        { value: "c", borderLeft: {}, borderRight: {}, borderTop: {} },
      ],
      [
        { value: "d", borderLeft: {}, borderRight: {} },
        { value: "e", border: null },
        { value: "f", borderLeft: {}, borderRight: {} },
      ],
      [
        { value: "g", border: {} },
        { value: "h", borderTop: {}, borderBottom: {} },
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
        inner_only,
        head,
        foot,
        all,
      }),
    );
  });
});
