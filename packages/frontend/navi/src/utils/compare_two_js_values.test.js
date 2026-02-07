import { snapshotTests } from "@jsenv/snapshot";
import { compareTwoJsValues } from "./compare_two_js_values.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("array comparison - ordered (default behavior)", () => {
    const results = {};

    // Same order - should be equal
    results.same_order_strings = compareTwoJsValues(["a", "b", "c"], ["a", "b", "c"]);
    results.same_order_numbers = compareTwoJsValues([1, 2, 3], [1, 2, 3]);
    results.same_order_mixed = compareTwoJsValues(["a", 1, true], ["a", 1, true]);

    // Different order - should be different
    results.different_order_strings = compareTwoJsValues(["a", "b", "c"], ["c", "b", "a"]);
    results.different_order_numbers = compareTwoJsValues([1, 2, 3], [3, 2, 1]);
    results.different_order_mixed = compareTwoJsValues(["a", 1, true], [true, "a", 1]);

    // Different elements - should be different
    results.different_elements = compareTwoJsValues(["a", "b"], ["a", "c"]);

    // Different lengths - should be different  
    results.different_lengths = compareTwoJsValues(["a", "b"], ["a", "b", "c"]);

    // Empty arrays - should be equal
    results.both_empty = compareTwoJsValues([], []);

    return results;
  });

  test("array comparison - ignoreArrayOrder option", () => {
    const results = {};

    // Same elements, different order - should be equal with ignoreArrayOrder
    results.different_order_strings = compareTwoJsValues(
      ["a", "b", "c"], 
      ["c", "b", "a"], 
      { ignoreArrayOrder: true }
    );
    results.different_order_numbers = compareTwoJsValues(
      [1, 2, 3], 
      [3, 1, 2], 
      { ignoreArrayOrder: true }
    );
    results.different_order_mixed = compareTwoJsValues(
      ["hello", 42, true, null], 
      [null, 42, "hello", true], 
      { ignoreArrayOrder: true }
    );

    // Same elements, same order - should still be equal
    results.same_order_with_option = compareTwoJsValues(
      ["a", "b", "c"], 
      ["a", "b", "c"], 
      { ignoreArrayOrder: true }
    );

    // Different elements - should be different even with ignoreArrayOrder
    results.different_elements = compareTwoJsValues(
      ["a", "b", "c"], 
      ["a", "b", "d"], 
      { ignoreArrayOrder: true }
    );

    // Different lengths - should be different
    results.different_lengths = compareTwoJsValues(
      ["a", "b"], 
      ["a", "b", "c"], 
      { ignoreArrayOrder: true }
    );

    // Arrays with duplicates - order shouldn't matter
    results.duplicates_different_order = compareTwoJsValues(
      ["a", "b", "a", "c"], 
      ["c", "a", "b", "a"], 
      { ignoreArrayOrder: true }
    );

    // Arrays with duplicates - different counts should be different
    results.duplicates_different_counts = compareTwoJsValues(
      ["a", "b", "a"], 
      ["a", "b", "a", "a"], 
      { ignoreArrayOrder: true }
    );

    return results;
  });

  test("nested arrays with ignoreArrayOrder", () => {
    const results = {};

    // Nested arrays - outer array order ignored, inner arrays compared normally
    results.nested_arrays_outer_order = compareTwoJsValues(
      [["a", "b"], ["c", "d"]], 
      [["c", "d"], ["a", "b"]], 
      { ignoreArrayOrder: true }
    );

    // Nested arrays - inner array order matters (no deep ignoreArrayOrder)
    results.nested_arrays_inner_order = compareTwoJsValues(
      [["a", "b"], ["c", "d"]], 
      [["b", "a"], ["d", "c"]], 
      { ignoreArrayOrder: true }
    );

    // Deep nesting with objects
    results.nested_with_objects = compareTwoJsValues(
      [
        { id: 1, tags: ["red", "blue"] },
        { id: 2, tags: ["green", "yellow"] }
      ],
      [
        { id: 2, tags: ["green", "yellow"] },
        { id: 1, tags: ["red", "blue"] }
      ],
      { ignoreArrayOrder: true }
    );

    // Deep nesting - inner object arrays order should matter
    results.nested_objects_inner_arrays = compareTwoJsValues(
      [
        { id: 1, tags: ["red", "blue"] },
        { id: 2, tags: ["green", "yellow"] }
      ],
      [
        { id: 2, tags: ["yellow", "green"] }, // Inner array order changed
        { id: 1, tags: ["blue", "red"] }      // Inner array order changed
      ],
      { ignoreArrayOrder: true }
    );

    return results;
  });

  test("edge cases with ignoreArrayOrder", () => {
    const results = {};

    // Empty arrays
    results.both_empty = compareTwoJsValues([], [], { ignoreArrayOrder: true });
    results.one_empty = compareTwoJsValues([], ["a"], { ignoreArrayOrder: true });

    // Single element arrays
    results.single_element_same = compareTwoJsValues(["a"], ["a"], { ignoreArrayOrder: true });
    results.single_element_different = compareTwoJsValues(["a"], ["b"], { ignoreArrayOrder: true });

    // Arrays with null, undefined, NaN
    results.with_null_undefined = compareTwoJsValues(
      [null, undefined, "a"], 
      ["a", null, undefined], 
      { ignoreArrayOrder: true }
    );
    results.with_nan = compareTwoJsValues(
      [NaN, 1, 2], 
      [2, NaN, 1], 
      { ignoreArrayOrder: true }
    );

    // Arrays with objects
    results.objects_different_order = compareTwoJsValues(
      [{ a: 1 }, { b: 2 }], 
      [{ b: 2 }, { a: 1 }], 
      { ignoreArrayOrder: true }
    );

    // Arrays with functions (should handle gracefully)
    const fn1 = () => 1;
    const fn2 = () => 2;
    results.with_functions = compareTwoJsValues(
      [fn1, "a", fn2], 
      [fn2, fn1, "a"], 
      { ignoreArrayOrder: true }
    );

    return results;
  });

  test("performance case - identical arrays", () => {
    const results = {};

    // Same reference - should be fast
    const arr = ["a", "b", "c"];
    results.same_reference = compareTwoJsValues(arr, arr, { ignoreArrayOrder: true });

    // Large arrays with same elements in different order
    const largeArr1 = Array.from({ length: 10 }, (_, i) => `item-${i}`);
    const largeArr2 = [...largeArr1].reverse();
    results.large_arrays_reversed = compareTwoJsValues(
      largeArr1, 
      largeArr2, 
      { ignoreArrayOrder: true }
    );

    // Arrays with many duplicates
    const duplicateArr1 = ["a", "b", "a", "c", "b", "a"];
    const duplicateArr2 = ["b", "a", "c", "a", "b", "a"];
    results.many_duplicates = compareTwoJsValues(
      duplicateArr1, 
      duplicateArr2, 
      { ignoreArrayOrder: true }
    );

    return results;
  });

  test("comparison without ignoreArrayOrder vs with ignoreArrayOrder", () => {
    const testCases = [
      {
        name: "same_order",
        a: ["x", "y", "z"],
        b: ["x", "y", "z"]
      },
      {
        name: "different_order",
        a: ["x", "y", "z"],
        b: ["z", "x", "y"]
      },
      {
        name: "with_duplicates",
        a: ["a", "b", "a", "c"],
        b: ["c", "a", "b", "a"]
      },
      {
        name: "complex_nested",
        a: [
          { id: 1, values: [10, 20] },
          { id: 2, values: [30, 40] }
        ],
        b: [
          { id: 2, values: [30, 40] },
          { id: 1, values: [10, 20] }
        ]
      }
    ];

    const results = {};

    for (const testCase of testCases) {
      results[testCase.name] = {
        without_option: compareTwoJsValues(testCase.a, testCase.b),
        with_ignore_array_order: compareTwoJsValues(
          testCase.a, 
          testCase.b, 
          { ignoreArrayOrder: true }
        )
      };
    }

    return results;
  });
});