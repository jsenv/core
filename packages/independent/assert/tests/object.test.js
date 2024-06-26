import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("object", ({ test }) => {
  test("property are different", () => {
    assert({
      actual: {
        a: true,
      },
      expect: {
        a: {
          b: true,
        },
      },
    });
  });
  test("property removed", () => {
    assert({
      actual: {
        a: true,
      },
      expect: {
        a: true,
        should_be_there: true,
      },
    });
  });
  test("property added", () => {
    assert({
      actual: {
        a: true,
        should_not_be_there: true,
      },
      expect: {
        a: true,
      },
    });
  });
  test("false should be an object", () => {
    assert({
      actual: false,
      expect: { foo: true },
    });
  });
  test("object should be false", () => {
    assert({
      actual: {
        foo: { a: {} },
      },
      expect: false,
    });
  });
  test("false should be an object at property", () => {
    assert({
      actual: {
        foo: false,
      },
      expect: {
        foo: { a: true },
      },
    });
  });
  test("object should be false at property", () => {
    assert({
      actual: {
        foo: { a: true },
      },
      expect: {
        foo: false,
      },
    });
  });
  test("max depth inside diff", () => {
    assert({
      actual: {
        foo: {
          foo_a: { foo_a2: { foo_a3: {} } },
          foo_b: { foo_b2: { foo_b3: {} } },
        },
        bar: true,
      },
      expect: {
        foo: {
          foo_a: { foo_a2: { foo_a3: {} } },
          foo_b: { foo_b2: { foo_b3: {} } },
        },
        bar: { bar_a: { bar_a2: {} } },
      },
      MAX_DEPTH: 2,
      MAX_DEPTH_INSIDE_DIFF: 1,
    });
  });
  test("max diff per object", () => {
    assert({
      actual: {
        a: true,
        b: {
          a: {
            y: true,
            z: true,
          },
        },
        c: true,
      },
      expect: {
        c: true,
        b: { a: false },
        a: true,
      },
      MAX_DIFF_INSIDE_VALUE: 2,
    });
  });
  test("max 2 context after diff (there is 2)", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
      },
      expect: {
        a: false,
        b: true,
        c: true,
      },
    });
  });
  test("max 2 context after diff (there is 3)", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
        e: true,
      },
      expect: {
        a: false,
        b: true,
        c: true,
        d: true,
      },
    });
  });
  test("max 2 context after diff (there is 4)", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
        d: true,
        e: true,
      },
      expect: {
        a: false,
        b: true,
        c: true,
        d: true,
        e: true,
      },
    });
  });
  test("max 2 context before diff (there is 2)", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
      },
      expect: {
        a: true,
        b: true,
        c: false,
      },
    });
  });
  test("max 2 context before diff (there is 3)", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
        d: true,
      },
      expect: {
        a: true,
        b: true,
        c: true,
        d: false,
      },
    });
  });
  test("max 2 context before diff (there is 4)", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
        d: true,
        e: true,
      },
      expect: {
        a: true,
        b: true,
        c: true,
        d: true,
        e: false,
      },
    });
  });
  test("max 2 context around diff", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
        d: true,
        e: true,
        f: true,
        g: true,
        h: true,
        i: true,
        j: true,
        k: true,
        l: true,
        m: true,
        n: true,
        o: true,
        p: true,
      },
      expect: {
        a: true,
        b: true,
        c: true,
        d: false,
        e: true,
        f: true,
        g: true,
        h: false,
        i: true,
        j: true,
        k: true,
        l: true,
        m: false,
        n: true,
        o: true,
        p: true,
      },
      MAX_DIFF_INSIDE_VALUE: 3,
    });
  });
  test("max 1 context around diff", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
      },
      expect: {
        c: true,
        b: false,
        a: true,
      },
      MAX_CONTEXT_BEFORE_DIFF: 1,
      MAX_CONTEXT_AFTER_DIFF: 1,
    });
  });
  test("max 0 context around diff", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
      },
      expect: {
        c: true,
        b: false,
        a: true,
      },
      MAX_CONTEXT_BEFORE_DIFF: 0,
      MAX_CONTEXT_AFTER_DIFF: 0,
    });
  });
  test("property should be there and is big", () => {
    assert({
      actual: {
        a: true,
      },
      expect: {
        a: true,
        should_be_there: {
          a: true,
          b: true,
          item: { a: 1, b: 1, c: 1 },
          c: true,
          d: true,
          e: true,
          f: true,
          g: true,
        },
      },
      MAX_COLUMNS: 100,
      MAX_DIFF_INSIDE_VALUE: 3,
    });
  });
  test("many props should not be there", () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: { an_object: true, and: true },
        d: true,
        e: true,
        f: true,
        g: true,
        h: true,
      },
      expect: {
        a: true,
        c: {},
      },
      MAX_DIFF_INSIDE_VALUE: 3,
    });
  });
  test("object vs user", () => {
    assert({
      actual: {},
      expect: {
        [Symbol.toStringTag]: "User",
      },
    });
  });
  test("collapsed with overview when no diff", () => {
    assert({
      actual: {
        a: { foo: true, bar: true, baz: { t: 1 } },
        b: true,
      },
      expect: {
        a: { foo: true, bar: true, baz: { t: 1 } },
        b: false,
      },
    });
  });
  test("one prop no diff", () => {
    assert({
      actual: {
        a: { foo: true },
        z: true,
      },
      expect: {
        a: { foo: true },
        z: false,
      },
    });
  });
});

// await startSnapshotTesting("object", {
//   ["false should be an object at property"]: () => {
//     assert({
//       actual: {
//         foo: false,
//       },
//       expect: {
//         foo: { a: true },
//       },
//     });
//   },
//   ["object should be false at property"]: () => {
//     assert({
//       actual: {
//         foo: { a: true },
//       },
//       expect: {
//         foo: false,
//       },
//     });
//   },
//   ["object should be false at deep property truncated"]: () => {
//     assert({
//       actual: {
//         the: { nesting: { is: {} } },
//         toto: "actual",
//       },
//       expect: false,
//       maxDepth: 0,
//     });
//   },
//   ["object should be false at deep property"]: () => {
//     assert({
//       actual: {
//         the: {
//           nesting: {
//             is: {
//               very: {
//                 deep: {
//                   in: {
//                     this: {
//                       one: {
//                         foo: {
//                           a: true,
//                           tata: { test: true, bar: { a: "1" } },
//                         },
//                       },
//                     },
//                   },
//                 },
//               },
//             },
//           },
//         },
//         toto: "actual",
//       },
//       expect: {
//         the: {
//           nesting: {
//             is: {
//               very: {
//                 deep: {
//                   in: {
//                     this: {
//                       one: {
//                         foo: false,
//                       },
//                     },
//                   },
//                 },
//               },
//             },
//           },
//         },
//         toto: "expect",
//       },
//       maxDepth: 5,
//     });
//   },
//   ["maxDepth on diff"]: () => {
//     assert({
//       actual: {
//         foo: {
//           a: { b: { c: { d: { e: { f: {} } } } } },
//         },
//       },
//       expect: {
//         foo: {
//           a: true,
//         },
//       },
//       maxDepth: 5,
//     });
//   },
//   ["max X diff per object"]: () => {
//     assert({
//       actual: {
//         a: true,
//         b: true,
//         c: true,
//       },
//       expect: {
//         a: false,
//         b: false,
//         c: false,
//       },
//       maxDiffPerObject: 2,
//     });
//   },
//   ["property should be there and is big"]: () => {
//     assert({
//       actual: {
//         a: true,
//       },
//       expect: {
//         a: true,
//         should_be_there: {
//           a: true,
//           b: true,
//           item: { a: 1, b: 1, c: 1 },
//           c: true,
//           d: true,
//           e: true,
//           f: true,
//           g: true,
//         },
//       },
//       maxColumns: 100,
//     });
//   },
//   ["many props should not be there"]: () => {
//     assert({
//       actual: {
//         a: true,
//         b: true,
//         c: { an_object: true, and: true },
//         d: true,
//         e: true,
//         f: true,
//         g: true,
//         h: true,
//       },
//       expect: {
//         a: true,
//         c: {},
//       },
//     });
//   },
//   ["max prop in diff"]: () => {
//     assert({
//       actual: {
//         foo: {
//           a: true,
//           b: true,
//           c: true,
//           d: true,
//           e: true,
//         },
//       },
//       expect: {
//         foo: false,
//       },
//       maxValueInsideDiff: 2,
//     });
//   },
//   ["props order"]: () => {
//     assert({
//       actual: {
//         b: true,
//         a: false,
//       },
//       expect: {
//         a: true,
//         b: false,
//       },
//     });
//   },
//   ["property key truncated"]: () => {
//     assert({
//       actual: {
//         "a quite long property key that will be truncated": true,
//       },
//       expect: {
//         "a quite long property key that will be truncated": false,
//       },
//       maxColumns: 40,
//     });
//   },
//   ["property key multiline"]: () => {
//     assert({
//       actual: {
//         "first\nsecond that is quite long": true,
//       },
//       expect: {
//         "first\nsecond that is quite long": false,
//       },
//       maxColumns: 30,
//     });
//   },
//   ["nested object becomes false"]: () => {
//     assert({
//       actual: false,
//       expect: {
//         a: true,
//         b: { toto: true },
//         c: true,
//       },
//     });
//   },
//   ["osc becomes dam at property value nested"]: () => {
//     assert({
//       actual: {
//         user: { name: "dam" },
//       },
//       expect: {
//         user: { name: "osc" },
//       },
//     });
//   },
// });
