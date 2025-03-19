import { snapshotTests } from "@jsenv/snapshot";
import { renderTable } from "./table.js";

const run = (lines, options) => {
  return renderTable(lines, options);
};

await snapshotTests(
  import.meta.url,
  ({ test }) => {
    const scenarios = {
      none: {
        borderTop: null,
        borderLeft: null,
        borderRight: null,
        borderBottom: null,
      },
      top: {
        borderTop: {},
        borderLeft: null,
        borderRight: null,
        borderBottom: null,
      },
      left: {
        borderTop: null,
        borderLeft: {},
        borderRight: null,
        borderBottom: null,
      },
      right: {
        borderTop: null,
        borderLeft: null,
        borderRight: {},
        borderBottom: null,
      },
      bottom: {
        borderTop: null,
        borderLeft: null,
        borderRight: null,
        borderBottom: {},
      },
      topLeft: {
        borderTop: {},
        borderLeft: {},
        borderRight: null,
        borderBottom: null,
      },
      topRight: {
        borderTop: {},
        borderLeft: null,
        borderRight: {},
        borderBottom: null,
      },
      bottomRight: {
        borderTop: null,
        borderLeft: null,
        borderRight: {},
        borderBottom: {},
      },
      bottomLeft: {
        borderTop: null,
        borderLeft: {},
        borderRight: null,
        borderBottom: {},
      },
      leftAndRight: {
        borderTop: null,
        borderLeft: {},
        borderRight: {},
        borderBottom: null,
      },
      topAndBottom: {
        borderTop: {},
        borderLeft: null,
        borderRight: null,
        borderBottom: {},
      },
      allButTop: {
        borderTop: null,
        borderLeft: {},
        borderRight: {},
        borderBottom: {},
      },
      allButRight: {
        borderTop: {},
        borderLeft: {},
        borderRight: null,
        borderBottom: {},
      },
      allButLeft: {
        borderTop: {},
        borderLeft: null,
        borderRight: {},
        borderBottom: {},
      },
      allButBottom: {
        borderTop: {},
        borderLeft: {},
        borderRight: {},
        borderBottom: null,
      },
      all: {
        borderLeft: {},
        borderTop: {},
        borderRight: {},
        borderBottom: {},
      },
    };

    test(`0_single_cell_borders`, () => {
      const keys = Object.keys(scenarios);
      for (const scenario of keys) {
        const text = run([[{ value: "1", ...scenarios[scenario] }]], {
          ansi: false,
        });
        console.log(`--- ${scenario} ---

${text}`);
      }
    });

    // test.ONLY("2_two_lines", () => {
    //   return run([
    //     [{ value: "1", ...borderAllAround }],
    //     [{ value: "2", ...borderAllAround }],
    //   ]);
    // });
  },
  {
    logEffects: {
      group: false,
    },
  },
);

// test(`
//     ┌─────────┐
//     │ (index) │
//     ├─────────┤
//     │ 0       │
//     │ 1       │
//     └─────────┘`);
