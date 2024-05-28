import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("map", {
  ["map entry added"]: () => {
    assert({
      actual: new Map(
        [["a", true]], //
      ),
      expect: new Map(),
    });
  },
  ["map entry removed"]: () => {
    assert({
      actual: new Map(),
      expect: new Map([
        ["a", true], //
      ]),
    });
  },
  ["map value modified"]: () => {
    assert({
      actual: new Map([
        ["a", true], //
      ]),
      expect: new Map([
        ["a", false], //
      ]),
    });
  },
  // ["map key is an object"]: () => {
  //   const object = { name: "test" };
  //   assert({
  //     actual: new Map([
  //       [object, true], //
  //     ]),
  //     expect: new Map([
  //       [object, false], //
  //     ]),
  //   });
  // },
  // ["map key objects are compared by identity"]: () => {
  //   assert({
  //     actual: new Map([
  //       [{ name: "a" }, true], //
  //     ]),
  //     expect: new Map([
  //       [{ name: "a" }, false], //
  //     ]),
  //   });
  // },
  // ["map key objects are collapsed and take a subset of max columns"]: () => {
  //   const object = { name: "test", anOtherProperty: "relatively_long" };
  //   assert({
  //     actual: new Map([
  //       [object, true], //
  //     ]),
  //     expect: new Map([
  //       [object, false], //
  //     ]),
  //     maxColumns: 35,
  //   });
  // },
  // ["map comparing with object"]: () => {
  //   assert({
  //     actual: new Map([["a", true]]),
  //     expect: {
  //       a: false,
  //     },
  //   });
  // },
  // ["object with map"]: () => {
  //   assert({
  //     actual: {
  //       a: false,
  //     },
  //     expect: new Map([["a", true]]),
  //   });
  // },
  // ["object with map having cusom prop"]: () => {
  //   assert({
  //     actual: {
  //       a: false,
  //     },
  //     expect: Object.assign(new Map([["a", true]]), {
  //       a: true,
  //     }),
  //   });
  // },
  // ["map having cusom prop with object"]: () => {
  //   assert({
  //     actual: Object.assign(new Map([["a", true]]), {
  //       a: true,
  //     }),
  //     expect: {
  //       a: false,
  //     },
  //   });
  // },
});
