/*
 * This file is named "scratch" as a testimony of the fact it has been
 * recoded from scratch around april 2024
 *
 * Nice to have:
 * - preact signals
 * - a DOM node should be converted to outerHTML right?
 * - ansi in browser
 * - Blob, FormData, DataView, ArrayBuffer
 * - count diff + displayed diff ( + display in message?)
 * - add or removed reason must be unique
 * - maintenir le format de date lorsqu'il est le meme dans actual/expect et favoriser celui de actual
 */

import { ANSI, UNICODE } from "@jsenv/humanize";
import stripAnsi from "strip-ansi";
import { applyStyles, truncateAndApplyColor } from "./render_style.js";
import {
  enableMultilineDiff,
  isSourceCodeProperty,
  renderChar,
  renderChildren,
  renderChildrenMultiline,
  renderChildrenMultilineWhenDiff,
  renderEmptyValue,
  renderNumber,
  renderPrimitive,
  renderString,
  renderValue,
} from "./renderers.js";
import {
  ARRAY_EMPTY_VALUE,
  SOURCE_CODE_ENTRY_KEY,
  SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY,
  VALUE_OF_RETURN_VALUE_ENTRY_KEY,
} from "./special_values.js";
import { getPropertyValueNode } from "./utils.js";
import { canParseDate, usesTimezone } from "./utils/can_parse_date.js";
import { groupDigits } from "./utils/group_digits.js";
import { isComposite } from "./utils/is_composite.js";
import { getIsNegativeZero } from "./utils/negative_zero.js";
import {
  getObjectTag,
  objectPrototypeChainGenerator,
} from "./utils/object_tag.js";
import { isValidPropertyIdentifier } from "./utils/property_identifier.js";
import {
  defaultFunctionAnalysis,
  tokenizeFunction,
} from "./utils/tokenize_function.js";
import { tokenizeFloat, tokenizeInteger } from "./utils/tokenize_number.js";
import { tokenizeUrlSearch } from "./utils/tokenize_url_search.js";
import { createValuePath } from "./utils/value_path.js";

// ANSI.supported = false;
const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectColor = ANSI.RED;
const expectColor = ANSI.GREEN;
/**
 * When a js value CANNOT EXISTS in actual or expect
 * the missing Node is set to PLACEHOLDER_FOR_NOTHING
 * For example,
 * - actual is a primitive, it cannot have properties
 * - expect is a composite, it can have properties
 * -> result into something like this
 * actual: true {
 *   <a>PLACEHOLDER_FOR_NOTHING
 * }
 * expect: {
 *   <a>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_FOR_NOTHING = {
  placeholder: "nothing",
  context: {},
};
/**
 * When a js value DOES NOT EXISTS ANYMORE in actual or expect
 * the missing Node is set to PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * For example,
 * - actual has 2 properties: "a" and "b"
 * - expect has 2 propertie: "a" and "c"
 * -> result into something like this
 * actual: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>ownPropertyDescriptorEntry,
 *   <c>PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * },
 * expect: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
 *   <c>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_WHEN_ADDED_OR_REMOVED = {
  placeholder: "added_or_removed",
  context: {},
};
const PLACEHOLDER_FOR_SAME = {
  placeholder: "same",
  context: {},
};
const PLACEHOLDER_FOR_MODIFIED = {
  placeholder: "modified",
  context: {},
};

const defaultOptions = {
  actual: undefined,
  expect: undefined,
  MAX_DEPTH: 5,
  MAX_DEPTH_INSIDE_DIFF: 2,
  MAX_DIFF: 15,
  MAX_DIFF_PER_VALUE: {
    "prop": 2,
    "line": 1,
    "*": 5,
  },
  MAX_CONTEXT_BEFORE_DIFF: { prop: 2, line: 3 },
  MAX_CONTEXT_AFTER_DIFF: { prop: 2, line: 3 },
  MAX_COLUMNS: undefined,
  order: "natural", // "natural", "sort"
  forceMultilineDiff: false,
  message: "",
  details: "",
};

export const createAssert = ({
  colors = true,
  underlines = "trailing_space_multiline_diff", // "any_diff", "trailing_space_multiline_diff"
  measureStringWidth = (string) => stripAnsi(string).length,
  tokenizeString = (string) => string.split(""),
  getWellKnownValuePath,
  MAX_COLUMNS_DEFAULT = 100,
} = {}) => {
  const assert = (firstArg, ...rest) => {
    if (firstArg === undefined) {
      throw new TypeError(
        `assert must be called with { actual, expect }, it was called without any argument`,
      );
    }
    if (rest.length) {
      throw new TypeError(
        `assert must be called with { actual, expect }, it was called with too many arguments`,
      );
    }
    if (firstArg === null || typeof firstArg !== "object") {
      throw new TypeError(
        `assert must be called with { actual, expect }, received ${firstArg} as first argument instead of object`,
      );
    }
    if (!Object.hasOwn(firstArg, "actual")) {
      throw new TypeError(
        `assert must be called with { actual, expect }, actual is missing`,
      );
    }
    if (!Object.hasOwn(firstArg, "expect")) {
      throw new TypeError(
        `assert must be called with { actual, expect }, expect is missing`,
      );
    }
    const unexpectedParamNames = Object.keys(firstArg).filter(
      (key) => !Object.hasOwn(defaultOptions, key),
    );
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `"${unexpectedParamNames.join(",")}": there is no such param`,
      );
    }
    const {
      actual,
      expect,
      MAX_DEPTH,
      MAX_DEPTH_INSIDE_DIFF,
      MAX_DIFF,
      MAX_DIFF_PER_VALUE,
      MAX_CONTEXT_BEFORE_DIFF,
      MAX_CONTEXT_AFTER_DIFF,
      MAX_COLUMNS = MAX_COLUMNS_DEFAULT,
      order,
      forceMultilineDiff,
      message,
      details,
    } = {
      ...defaultOptions,
      ...firstArg,
    };

    const sharedContext = {
      forceMultilineDiff,
      getWellKnownValuePath,
      tokenizeString,
      measureStringWidth,
      assert,
      order,
    };
    const actualRootNode = createRootNode({
      context: {
        ...sharedContext,
        colorWhenSolo: addedColor,
        colorWhenSame: sameColor,
        colorWhenModified: unexpectColor,
        name: "actual",
        origin: "actual",
      },
      value: actual,
      // otherValue: expect,
      render: renderValue,
    });
    const expectRootNode = createRootNode({
      context: {
        ...sharedContext,
        colorWhenSolo: removedColor,
        colorWhenSame: sameColor,
        colorWhenModified: expectColor,
        name: "expect",
        origin: "expect",
      },
      value: expect,
      // otherValue: actual,
      render: renderValue,
    });

    const causeSet = new Set();

    /*
     * Comparison are objects used to compare actualNode and expectNode
     * It is used to visit all the entry a js value can have
     * and progressively create a tree of node and comparison
     * as the visit progresses a diff is generated
     * In the process an other type of object is used called *Entry
     * The following entry exists:
     * - ownPropertyDescriptorEntry
     * - ownPropertySymbolEntry
     * - indexedEntry
     *   - array values
     *   - typed array values
     *   - string values
     * - internalEntry
     *   - url internal props
     *   - valueOf()
     *   - Symbol.toPrimitive()
     *   - function body
     *   - map keys and values
     *   - ....
     * Entry represent something that can be found in the js value
     * and can be associated with one or many node (js_value)
     * For example ownPropertyDescriptorEntry have 3 nodes:
     *   ownPropertyNameNode
     *   descriptorKeyNode
     *   descriptorValueNode
     */
    let isNot = false;
    let allowRecompare = false;
    let diffCount = 0;
    let maxDiffReached = false;
    const compare = (actualNode, expectNode, { onDiffCallback } = {}) => {
      if (actualNode.ignore && actualNode.comparison) {
        return actualNode.comparison;
      }
      if (expectNode.ignore && expectNode.comparison) {
        return expectNode.comparison;
      }

      let maxDiffPerValue;
      if (typeof MAX_DIFF_PER_VALUE === "number") {
        maxDiffPerValue = MAX_DIFF_PER_VALUE;
      } else {
        const node = actualNode.placeholder ? expectNode : actualNode;
        const valueType =
          node.subgroup === "line_entries"
            ? "line"
            : node.subgroup === "own_properties"
              ? "prop"
              : node.subgroup === "indexed_entries"
                ? "index"
                : "other";
        if (valueType in MAX_DIFF_PER_VALUE) {
          maxDiffPerValue = MAX_DIFF_PER_VALUE[valueType];
        } else if ("*" in MAX_DIFF_PER_VALUE) {
          maxDiffPerValue = MAX_DIFF_PER_VALUE["*"];
        } else if ("prop" in MAX_DIFF_PER_VALUE) {
          maxDiffPerValue = MAX_DIFF_PER_VALUE.prop;
        } else {
          maxDiffPerValue = Infinity;
        }
      }
      let maxDiffPerValueReached = false;
      let diffPerValueCounter = 0;

      const reasons = createReasons();
      if (maxDiffReached) {
        if (!actualNode.placeholder) {
          actualNode.maxDiffReached = true;
        }
        if (!expectNode.placeholder) {
          expectNode.maxDiffReached = true;
        }
      }
      const comparison = {
        actualNode,
        expectNode,
        reasons,
        done: false,
      };
      if (!actualNode.placeholder) {
        actualNode.otherNode = expectNode;
      }
      if (!expectNode.placeholder) {
        expectNode.otherNode = actualNode;
      }

      const onDiff = (node) => {
        if (isSourceCodeProperty(node)) {
          return;
        }
        diffCount++;
        if (!maxDiffReached && diffCount >= MAX_DIFF) {
          maxDiffReached = true;
        }
        onDiffCallback(node);
      };
      const onDuoDiff = (node) => {
        if (!node.isStandaloneDiff) {
          return;
        }
        onDiff(node);
      };
      const onSoloDiff = (node) => {
        if (!node.isStandaloneDiff) {
          return;
        }
        if (node.group === "entry_key") {
          // will be also reported by the value
          return;
        }
        onDiff(node);
      };
      const onSelfDiff = (reason) => {
        reasons.self.modified.add(reason);
        causeSet.add(comparison);
        onDuoDiff(comparison.actualNode);
      };
      const onAdded = (reason) => {
        reasons.self.added.add(reason);
        causeSet.add(comparison);
        onSoloDiff(comparison.actualNode);
      };
      const onRemoved = (reason) => {
        reasons.self.removed.add(reason);
        causeSet.add(comparison);
        onSoloDiff(comparison.expectNode);
      };

      const subcompareDuo = (
        actualChildNode,
        expectChildNode,
        { revertNot, isRecomparison } = {},
      ) => {
        let isNotPrevious = isNot;
        if (revertNot) {
          isNot = !isNot;
        }
        if (isRecomparison) {
          allowRecompare = true;
        }
        if (maxDiffPerValueReached) {
          if (!actualChildNode.placeholder) {
            actualChildNode.maxDiffReached = true;
          }
          if (!expectChildNode.placeholder) {
            expectChildNode.maxDiffReached = true;
          }
        }
        const childComparison = compare(actualChildNode, expectChildNode, {
          onDiffCallback: (node) => {
            onDiffCallback(node);
            diffPerValueCounter++;
            if (
              !maxDiffPerValueReached &&
              diffPerValueCounter >= maxDiffPerValue
            ) {
              maxDiffPerValueReached = true;
            }
          },
        });
        isNot = isNotPrevious;
        appendReasonGroup(
          comparison.reasons.inside,
          childComparison.reasons.overall,
        );
        return childComparison;
      };
      const subcompareSolo = (childNode, placeholderNode, compareOptions) => {
        if (childNode.context.name === "actual") {
          return subcompareDuo(childNode, placeholderNode, compareOptions);
        }
        return subcompareDuo(placeholderNode, childNode, compareOptions);
      };
      const subcompareChildrenDuo = (actualNode, expectNode) => {
        const isSetEntriesComparison =
          actualNode.subgroup === "set_entries" &&
          expectNode.subgroup === "set_entries";
        const childComparisonMap = new Map();
        const childComparisonDiffMap = new Map();
        const referenceNode = expectNode;
        const otherNode = actualNode;
        reference_children_comparisons: {
          const childrenKeys = [];
          let firstChildWithDiffKey;
          for (let [childKey, childNode] of referenceNode.childNodeMap) {
            let otherChildNode;
            if (isSetEntriesComparison) {
              const setValueNode = childNode;
              for (const [, otherSetValueNode] of otherNode.childNodeMap) {
                if (otherSetValueNode.value === setValueNode.value) {
                  otherChildNode = otherSetValueNode;
                  break;
                }
              }
            } else {
              otherChildNode = otherNode.childNodeMap.get(childKey);
            }
            if (childNode && otherChildNode) {
              const childComparison = subcompareDuo(otherChildNode, childNode);
              childComparisonMap.set(childKey, childComparison);
              if (childComparison.hasAnyDiff) {
                childComparisonDiffMap.set(childKey, childComparison);
              }
              if (!childNode.isHidden) {
                childrenKeys.push(childKey);
                if (
                  childComparison.hasAnyDiff &&
                  firstChildWithDiffKey === undefined
                ) {
                  firstChildWithDiffKey = childKey;
                }
              }
              continue;
            }
            const removedChildComparison = subcompareSolo(
              childNode,
              PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
            );
            childComparisonMap.set(childKey, removedChildComparison);
            childComparisonDiffMap.set(childKey, removedChildComparison);
            if (!childNode.isHidden) {
              childrenKeys.push(childKey);
              if (firstChildWithDiffKey === undefined) {
                firstChildWithDiffKey = childKey;
              }
            }
          }
          if (referenceNode.context.order === "sort") {
            childrenKeys.sort();
          }
          referenceNode.childrenKeys = childrenKeys;
          referenceNode.firstChildWithDiffKey = firstChildWithDiffKey;
        }
        other_children_comparisons: {
          const childrenKeys = [];
          let firstChildWithDiffKey;
          for (let [childKey, childNode] of otherNode.childNodeMap) {
            if (isSetEntriesComparison) {
              const setValueNode = childNode;
              let hasEntry;
              for (const [
                ,
                referenceSetValueNode,
              ] of referenceNode.childNodeMap) {
                if (referenceSetValueNode.value === setValueNode.value) {
                  hasEntry = true;
                  break;
                }
              }
              if (hasEntry) {
                if (!childNode.isHidden) {
                  childrenKeys.push(childKey);
                }
                continue;
              }
            } else {
              const childComparison = childComparisonMap.get(childKey);
              if (childComparison) {
                if (!childNode.isHidden) {
                  childrenKeys.push(childKey);
                  if (
                    childComparison.hasAnyDiff &&
                    firstChildWithDiffKey === undefined
                  ) {
                    firstChildWithDiffKey = childKey;
                  }
                }
                continue;
              }
            }
            const addedChildComparison = subcompareSolo(
              childNode,
              PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
            );
            childComparisonMap.set(childKey, addedChildComparison);
            childComparisonDiffMap.set(childKey, addedChildComparison);
            if (!childNode.isHidden) {
              childrenKeys.push(childKey);
              if (firstChildWithDiffKey === undefined) {
                firstChildWithDiffKey = childKey;
              }
            }
          }
          if (otherNode.context.order === "sort") {
            childrenKeys.sort();
          }
          otherNode.childrenKeys = childrenKeys;
          otherNode.firstChildWithDiffKey = firstChildWithDiffKey;
        }
        actualNode.childComparisonDiffMap = childComparisonDiffMap;
        expectNode.childComparisonDiffMap = childComparisonDiffMap;
      };
      const subcompareChildrenSolo = (node, placeholderNode) => {
        const childComparisonDiffMap = new Map();
        const childrenKeys = [];
        let firstChildWithDiffKey;
        for (const [childKey, childNode] of node.childNodeMap) {
          const soloChildComparison = subcompareSolo(
            childNode,
            placeholderNode,
          );
          if (placeholderNode !== PLACEHOLDER_FOR_SAME) {
            childComparisonDiffMap.set(childKey, soloChildComparison);
          }
          if (!childNode.isHidden) {
            childrenKeys.push(childKey);
            if (
              placeholderNode !== PLACEHOLDER_FOR_SAME &&
              firstChildWithDiffKey === undefined
            ) {
              firstChildWithDiffKey = childKey;
            }
          }
        }
        if (node.context.order === "sort") {
          childrenKeys.sort();
        }
        node.childrenKeys = childrenKeys;
        node.firstChildWithDiffKey = firstChildWithDiffKey;
        node.childComparisonDiffMap = childComparisonDiffMap;
      };

      const visitDuo = (actualNode, expectNode) => {
        if (actualNode.comparison && !allowRecompare) {
          throw new Error(
            `actualNode (${actualNode.subgroup}) already compared`,
          );
        }
        actualNode.comparison = comparison;
        if (expectNode.comparison && !allowRecompare) {
          throw new Error(
            `expectNode (${expectNode.subgroup}) already compared`,
          );
        }
        expectNode.comparison = comparison;
        const { result, reason, propagate } = comparerDefault(
          actualNode,
          expectNode,
        );
        if (result === "failure") {
          onSelfDiff(reason);
          if (propagate) {
            subcompareChildrenSolo(actualNode, propagate);
            subcompareChildrenSolo(expectNode, propagate);
            return;
          }
          subcompareChildrenDuo(actualNode, expectNode);
          return;
        }
        if (result === "success") {
          if (propagate) {
            const actualRender = actualNode.render;
            const expectRender = expectNode.render;
            actualNode.render = (props) => {
              actualNode.render = actualRender;
              // expectNode.render = expectRender;
              subcompareChildrenSolo(actualNode, PLACEHOLDER_FOR_SAME);
              return actualRender(props);
            };
            expectNode.render = (props) => {
              // actualNode.render = actualRender;
              expectNode.render = expectRender;
              subcompareChildrenSolo(expectNode, PLACEHOLDER_FOR_SAME);
              return expectRender(props);
            };
            if (actualNode.isHiddenWhenSame) {
              actualNode.isHidden = true;
            }
            if (expectNode.isHiddenWhenSame) {
              expectNode.isHidden = true;
            }
            return;
          }
          subcompareChildrenDuo(actualNode, expectNode);
          return;
        }
        subcompareChildrenDuo(actualNode, expectNode);
        if (
          // is root comparison between numbers?
          actualNode.subgroup === "number_composition" &&
          actualNode.parent.parent === null &&
          expectNode.parent.parent === null
        ) {
          const actualIntegerNode = actualNode.childNodeMap.get("integer");
          const expectIntegerNode = expectNode.childNodeMap.get("integer");
          if (actualIntegerNode && expectIntegerNode) {
            if (actualNode.parent.isInfinity === expectNode.parent.isInfinity) {
              const actualSignNode = actualNode.childNodeMap.get("sign");
              const expectSignNode = expectNode.childNodeMap.get("sign");
              let actualWidth = actualIntegerNode.value.length;
              let expectWidth = expectIntegerNode.value.length;
              if (actualSignNode) {
                actualWidth += "-".length;
              }
              if (expectSignNode) {
                expectWidth += "-".length;
              }
              const diff = Math.abs(expectWidth - actualWidth);
              if (diff < 10) {
                if (actualWidth < expectWidth) {
                  actualNode.startMarker = " ".repeat(
                    expectWidth - actualWidth,
                  );
                } else if (actualWidth > expectWidth) {
                  expectNode.startMarker = " ".repeat(
                    actualWidth - expectWidth,
                  );
                }
              }
            }
          }
        }
      };
      const visitSolo = (node, placeholderNode) => {
        if (node.comparison && !allowRecompare) {
          throw new Error(`node (${node.subgroup}) already compared`);
        }
        node.comparison = comparison;
        if (node.isHiddenWhenSolo) {
          node.isHidden = true;
        }
        subcompareChildrenSolo(node, placeholderNode);
      };

      visit: {
        // custom comparison
        if (
          expectNode.customCompare &&
          (actualNode.category === "primitive" ||
            actualNode.category === "composite")
        ) {
          expectNode.customCompare(actualNode, expectNode, {
            subcompareChildrenDuo,
            subcompareChildrenSolo,
            subcompareDuo,
            subcompareSolo,
            onSelfDiff,
          });
          break visit;
        }
        if (actualNode.category === expectNode.category) {
          visitDuo(actualNode, expectNode);
          break visit;
        }
        // not found in expect (added or expect cannot have this type of value)
        if (
          actualNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED ||
          actualNode === PLACEHOLDER_FOR_NOTHING
        ) {
          visitSolo(expectNode, actualNode);
          onRemoved(getAddedOrRemovedReason(expectNode));
          break visit;
        }
        // not found in actual (removed or actual cannot have this type of value)
        if (
          expectNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED ||
          expectNode === PLACEHOLDER_FOR_NOTHING
        ) {
          visitSolo(actualNode, expectNode);
          onAdded(getAddedOrRemovedReason(actualNode));
          break visit;
        }
        // force actual to be same/modified
        if (
          actualNode === PLACEHOLDER_FOR_SAME ||
          actualNode === PLACEHOLDER_FOR_MODIFIED
        ) {
          visitSolo(expectNode, actualNode);
          break visit;
        }
        // force expect to be same/modified
        if (
          expectNode === PLACEHOLDER_FOR_SAME ||
          expectNode === PLACEHOLDER_FOR_MODIFIED
        ) {
          visitSolo(actualNode, expectNode);
          break visit;
        }

        // not same category
        onSelfDiff(`should_be_${expect.category}`);
        // primitive expect
        if (
          expectNode.category === "primitive" &&
          actualNode.category === "composite"
        ) {
          const actualAsPrimitiveNode = asPrimitiveNode(actualNode);
          if (actualAsPrimitiveNode) {
            subcompareDuo(actualAsPrimitiveNode, expectNode);
            actualAsPrimitiveNode.ignore = true;
            visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
            break visit;
          }
        }
        // composite expect
        else if (
          expectNode.category === "composite" &&
          actualNode.category === "primitive"
        ) {
          const expectAsPrimitiveNode = asPrimitiveNode(expectNode);
          if (expectAsPrimitiveNode) {
            subcompareDuo(actualNode, expectAsPrimitiveNode);
            expectAsPrimitiveNode.ignore = true;
            visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
            break visit;
          }
        }
        visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
        visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
      }

      const { self, inside, overall } = comparison.reasons;
      appendReasons(self.any, self.modified, self.removed, self.added);
      appendReasons(inside.any, inside.modified, inside.removed, inside.added);
      appendReasons(overall.removed, self.removed, inside.removed);
      appendReasons(overall.added, self.added, inside.added);
      appendReasons(overall.modified, self.modified, inside.modified);
      appendReasons(overall.any, self.any, inside.any);
      comparison.selfHasRemoval = self.removed.size > 0;
      comparison.selfHasAddition = self.added.size > 0;
      comparison.selfHasModification = self.modified.size > 0;
      comparison.hasAnyDiff = overall.any.size > 0;
      comparison.done = true;

      const updateNodeDiffType = (node, otherNode) => {
        if (node.diffType !== "" && !allowRecompare) {
          return;
        }
        let diffType = "";
        if (otherNode === PLACEHOLDER_FOR_NOTHING) {
          diffType = "modified";
        } else if (otherNode === PLACEHOLDER_FOR_MODIFIED) {
          diffType = "modified";
        } else if (otherNode === PLACEHOLDER_FOR_SAME) {
          diffType = "same";
        } else if (otherNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
          diffType = "solo";
        } else if (comparison.selfHasModification) {
          diffType = "modified";
        } else {
          diffType = "same";
        }
        node.diffType = diffType;
        if (isNot) {
          node.color = node.context.colorWhenSame;
        } else {
          node.color = {
            solo: node.context.colorWhenSolo,
            modified: node.context.colorWhenModified,
            same: node.context.colorWhenSame,
          }[diffType];
        }
      };
      updateNodeDiffType(actualNode, expectNode);
      updateNodeDiffType(expectNode, actualNode);

      if (comparison.reasons.overall.any.size === 0) {
        if (actualNode.isHiddenWhenSame) {
          actualNode.isHidden = true;
        }
        if (expectNode.isHiddenWhenSame) {
          expectNode.isHidden = true;
        }
      }
      if (
        actualNode.subgroup === "line_entries" &&
        expectNode.subgroup === "line_entries"
      ) {
        const actualIsMultiline = actualNode.childNodeMap.size > 1;
        const expectIsMultiline = expectNode.childNodeMap.size > 1;
        if (actualIsMultiline && !expectIsMultiline) {
          enableMultilineDiff(expectNode);
        } else if (!actualIsMultiline && expectIsMultiline) {
          enableMultilineDiff(actualNode);
        } else if (!actualIsMultiline && !expectIsMultiline) {
          forceSameQuotes(actualNode, expectNode);
        }
      }
      if (
        actualNode.subgroup === "url_parts" &&
        expectNode.subgroup === "url_parts"
      ) {
        forceSameQuotes(actualNode, expectNode);
      }

      return comparison;
    };

    const rootComparison = compare(actualRootNode, expectRootNode, {
      onDiffCallback: () => {},
    });
    if (!rootComparison.hasAnyDiff) {
      return;
    }

    let diff = ``;
    const infos = [];

    let actualStartNode;
    let expectStartNode;
    start_on_max_depth: {
      if (rootComparison.selfHasModification) {
        actualStartNode = actualRootNode;
        expectStartNode = expectRootNode;
        break start_on_max_depth;
      }
      const getStartNode = (rootNode) => {
        let topMostNodeWithDiff = null;
        for (const comparisonWithDiff of causeSet) {
          const node =
            comparisonWithDiff[
              rootNode.context.name === "actual" ? "actualNode" : "expectNode"
            ];
          if (!topMostNodeWithDiff || node.depth < topMostNodeWithDiff.depth) {
            topMostNodeWithDiff = node;
          }
        }
        if (topMostNodeWithDiff.depth < MAX_DEPTH) {
          return rootNode;
        }
        let currentNode = topMostNodeWithDiff;
        let startDepth = topMostNodeWithDiff.depth - MAX_DEPTH;

        while (true) {
          const parentNode = currentNode.parent;
          if (!parentNode) {
            return rootNode;
          }
          if (
            parentNode.group !== "entries" &&
            parentNode.group !== "entry" &&
            parentNode.depth === startDepth
          ) {
            return parentNode;
          }
          currentNode = parentNode;
        }
      };
      actualStartNode = getStartNode(actualRootNode);
      expectStartNode = getStartNode(expectRootNode);
      if (
        actualStartNode !== actualRootNode &&
        expectStartNode !== expectRootNode
      ) {
        const actualStartNodePath = actualStartNode.path.pop().pop().toString();
        const expectStartNodePath = expectStartNode.path.pop().pop().toString();
        if (actualStartNodePath === expectStartNodePath) {
          infos.push(
            `diff starts at ${applyStyles(actualStartNode, actualStartNodePath, { color: ANSI.YELLOW, underline: false })}`,
          );
        } else {
          infos.push(
            `actual diff starts at ${applyStyles(actualStartNode, actualStartNodePath, { color: ANSI.YELLOW, underline: false })}`,
          );
          infos.push(
            `expect diff starts at ${applyStyles(expectStartNode, expectStartNodePath, { color: ANSI.YELLOW, underline: false })}`,
          );
        }
      } else if (actualStartNode !== actualRootNode) {
        infos.push(
          `actual diff starts at ${applyStyles(actualStartNode.path, { color: ANSI.YELLOW, underline: false })}`,
        );
      } else if (expectStartNode !== expectRootNode) {
        infos.push(
          `expect diff starts at ${applyStyles(expectStartNode, expectStartNode.path, { color: ANSI.YELLOW, underline: false })}`,
        );
      }
    }

    if (infos.length) {
      for (const info of infos) {
        diff += `${UNICODE.INFO} ${info}`;
        diff += "\n";
      }
      diff += "\n";
    }
    diff += applyStyles(actualStartNode, "actual:", {
      color: sameColor,
      underline: false,
    });
    diff += " ";
    const actualDiff = actualStartNode.render({
      MAX_DEPTH,
      MAX_DEPTH_INSIDE_DIFF,
      MAX_CONTEXT_BEFORE_DIFF,
      MAX_CONTEXT_AFTER_DIFF,
      MAX_COLUMNS,
      columnsRemaining: MAX_COLUMNS - "actual: ".length,
      startNode: actualStartNode,
    });
    diff += actualDiff;
    diff += `\n`;
    diff += applyStyles(expectStartNode, "expect:", {
      color: sameColor,
      underline: false,
    });
    diff += " ";
    const expectDiff = expectStartNode.render({
      MAX_DEPTH,
      MAX_DEPTH_INSIDE_DIFF,
      MAX_CONTEXT_BEFORE_DIFF,
      MAX_CONTEXT_AFTER_DIFF,
      MAX_COLUMNS,
      columnsRemaining: MAX_COLUMNS - "expect: ".length,
      startNode: expectStartNode,
    });
    diff += expectDiff;
    if (details) {
      diff += "\n";
      diff += `--- details ---`;
      diff += "\n";
      diff += JSON.stringify(details);
      diff += "\n";
      diff += `---------------`;
    }

    let errorMessage = "";
    if (message) {
      errorMessage += message;
      errorMessage += "\n\n";
      errorMessage += diff;
    } else {
      errorMessage += `${applyStyles(actualStartNode, "actual", { color: unexpectColor, underline: false })} and ${applyStyles(expectStartNode, "expect", { color: expectColor, underline: false })} are different`;
      errorMessage += "\n\n";
      errorMessage += diff;
    }
    const assertionError = assert.createAssertionError(errorMessage);
    defineNonEnumerableProperties(assertionError, {
      diff,
      actualDiff,
      expectDiff,
    });
    if (Error.captureStackTrace) {
      Error.captureStackTrace(assertionError, assert);
    }
    throw assertionError;
  };
  // for test
  assert.colors = colors;
  assert.underlines = underlines;
  class AssertionError extends Error {}
  assert.AssertionError = AssertionError;
  assert.createAssertionError = (message) => {
    const assertionError = new AssertionError(message);
    return assertionError;
  };
  assert.isAssertionError = (value) => {
    if (!value) return false;
    if (typeof value !== "object") return false;
    if (value.constructor.name === "AssertionError") return true;
    if (value.constructor.name.includes("AssertionError")) return true;
    return false;
  };
  assert.belowOrEquals = (value, options) => {
    if (typeof value !== "number") {
      throw new TypeError(
        `assert.belowOrEquals 1st argument must be number, received ${value}`,
      );
    }
    return createAssertMethodCustomExpectation(
      "belowOrEquals",
      [
        {
          value,
          customCompare: createValueCustomCompare((actualNode) => {
            if (!actualNode.isNumber) {
              return "should_be_a_number";
            }
            if (actualNode.value > value) {
              return `should_be_below_or_equals_to_${value}`;
            }
            return null;
          }),
        },
      ],
      options,
    );
  };
  assert.aboveOrEquals = (value, options) => {
    if (typeof value !== "number") {
      throw new TypeError(
        `assert.aboveOrEquals 1st argument must be number, received ${value}`,
      );
    }
    return createAssertMethodCustomExpectation(
      "aboveOrEquals",
      [
        {
          value,
          customCompare: createValueCustomCompare((actualNode) => {
            if (!actualNode.isNumber) {
              return "should_be_a_number";
            }
            if (actualNode.value < value) {
              return `should_be_greater_or_equals_to_${value}`;
            }
            return null;
          }),
        },
      ],
      options,
    );
  };
  assert.between = (minValue, maxValue) => {
    if (typeof minValue !== "number") {
      throw new TypeError(
        `assert.between 1st argument must be number, received ${minValue}`,
      );
    }
    if (typeof maxValue !== "number") {
      throw new TypeError(
        `assert.between 2nd argument must be number, received ${maxValue}`,
      );
    }
    if (minValue > maxValue) {
      throw new Error(
        `assert.between 1st argument is > 2nd argument, ${minValue} > ${maxValue}`,
      );
    }
    return createAssertMethodCustomExpectation("between", [
      {
        value: assert.aboveOrEquals(minValue, {
          renderOnlyArgs: true,
        }),
      },
      {
        value: assert.belowOrEquals(maxValue, {
          renderOnlyArgs: true,
          isRecomparison: true,
        }),
      },
    ]);
  };
  assert.not = (value) => {
    return createAssertMethodCustomExpectation(
      "not",
      [
        {
          value,
        },
      ],
      {
        customCompare: createAssertMethodCustomCompare(
          (
            actualNode,
            expectFirsArgValueNode,
            { subcompareDuo, onSelfDiff },
          ) => {
            const expectFirstArgComparison = subcompareDuo(
              actualNode,
              expectFirsArgValueNode,
              {
                revertNot: true,
              },
            );
            if (expectFirstArgComparison.hasAnyDiff) {
              // we should also "revert" side effects of all diff inside expectAsNode
              // - adding to causeSet
              // - colors (should be done during comparison)
              return PLACEHOLDER_FOR_SAME;
            }
            onSelfDiff("sould_have_diff");
            return PLACEHOLDER_WHEN_ADDED_OR_REMOVED;
          },
        ),
      },
    );
  };
  assert.any = (constructor) => {
    if (typeof constructor !== "function") {
      throw new TypeError(
        `assert.any 1st argument must be a function, received ${constructor}`,
      );
    }
    const constructorName = constructor.name;
    return createAssertMethodCustomExpectation("any", [
      {
        value: constructor,
        customCompare: createValueCustomCompare(
          constructorName
            ? (actualNode) => {
                for (const proto of objectPrototypeChainGenerator(
                  actualNode.value,
                )) {
                  const protoConstructor = proto.constructor;
                  if (protoConstructor.name === constructorName) {
                    return null;
                  }
                }
                return `should_have_constructor_${constructorName}`;
              }
            : (actualNode) => {
                for (const proto of objectPrototypeChainGenerator(
                  actualNode.value,
                )) {
                  const protoConstructor = proto.constructor;
                  if (protoConstructor === constructor) {
                    return null;
                  }
                }
                return `should_have_constructor_${constructor.toString()}`;
              },
        ),
      },
    ]);
  };
  assert.startsWith = (string) => {
    if (typeof string !== "string") {
      throw new TypeError(
        `assert.startsWith 1st argument must be a string, received ${string}`,
      );
    }
    return createAssertMethodCustomExpectation("startsWith", [
      {
        value: string,
        customCompare: createValueCustomCompare((actualNode) => {
          if (!actualNode.isString) {
            return "should_be_a_string";
          }
          const actual = actualNode.value;
          if (!actual.startsWith(string)) {
            return `should_start_with_${string}`;
          }
          return null;
        }),
      },
    ]);
  };
  assert.closeTo = (float, precision = 2) => {
    if (typeof float !== "number") {
      throw new TypeError(
        `assert.closeTo 1st argument must be a number, received ${float}`,
      );
    }
    return createAssertMethodCustomExpectation("closeTo", [
      {
        value: float,
        customCompare: createValueCustomCompare((actualNode) => {
          if (!actualNode.isNumber) {
            return "should_be_a_number";
          }
          const actual = actualNode.value;
          if (actual === Infinity && float === Infinity) {
            return null;
          }
          if (actual === -Infinity && float === -Infinity) {
            return null;
          }
          const expectedDiff = Math.pow(10, -precision) / 2;
          const receivedDiff = Math.abs(float - actual);
          if (receivedDiff > expectedDiff) {
            return `should_be_close_to_${float}`;
          }
          return null;
        }),
      },
    ]);
  };
  assert.matches = (regexp) => {
    if (typeof regexp !== "object") {
      throw new TypeError(
        `assert.matches 1st argument must be a regex, received ${regexp}`,
      );
    }
    return createAssertMethodCustomExpectation("matches", [
      {
        value: regexp,
        customCompare: createValueCustomCompare((actualNode) => {
          if (!actualNode.isString) {
            return "should_be_a_string";
          }
          const actual = actualNode.value;
          if (!regexp.test(actual)) {
            return `should_match_${regexp}`;
          }
          return null;
        }),
      },
    ]);
  };
  return assert;
};

const defineNonEnumerableProperties = (assertionError, properties) => {
  for (const key of Object.keys(properties)) {
    Object.defineProperty(assertionError, key, {
      configurable: true,
      writable: true,
      value: properties[key],
    });
  }
};

const comparerDefault = (actualNode, expectNode) => {
  if (
    actualNode.category === "primitive" ||
    actualNode.category === "line_parts" ||
    actualNode.category === "date_parts" ||
    actualNode.category === "url_parts" ||
    actualNode.category === "header_value_parts"
  ) {
    if (
      actualNode.value === expectNode.value &&
      actualNode.isNegativeZero === expectNode.isNegativeZero
    ) {
      return {
        result: "success",
        propagate: PLACEHOLDER_FOR_SAME,
      };
    }
    if (actualNode.category === "primitive") {
      return {
        result: "failure",
        reason: "primitive_value",
        // Some primitive have children to render (like numbers)
        // when comparison a boolean and a number for instance
        // all number children will be colored in yellow because
        // they have no counterparts as boolean node
        // What we want instead is to color the number children in red/green
        propagate:
          typeof actualNode.value === typeof expectNode.value
            ? null
            : PLACEHOLDER_FOR_MODIFIED,
      };
    }
    return {
      result: "",
    };
  }
  if (actualNode.category === "composite") {
    if (actualNode.value === expectNode.value) {
      return {
        result: "success",
        propagate: PLACEHOLDER_FOR_SAME,
      };
    }
    return { result: "" };
  }
  if (actualNode.category === "reference") {
    const actualRefPathString = actualNode.value.pop().toString();
    const expectRefPathString = expectNode.value.pop().toString();
    if (actualRefPathString !== expectRefPathString) {
      return {
        result: "failure",
        reason: "ref_path",
        propagate: PLACEHOLDER_FOR_MODIFIED,
      };
    }
    return {
      result: "success",
      propagate: PLACEHOLDER_FOR_SAME,
    };
  }
  if (actualNode.category === "entries") {
    if (
      actualNode.multilineDiff &&
      expectNode.multilineDiff &&
      actualNode.multilineDiff.hasMarkersWhenEmpty !==
        expectNode.multilineDiff.hasMarkersWhenEmpty
    ) {
      actualNode.multilineDiff.hasMarkersWhenEmpty =
        expectNode.multilineDiff.hasMarkersWhenEmpty = true;
    }
    if (
      actualNode.onelineDiff &&
      expectNode.onelineDiff &&
      actualNode.onelineDiff.hasMarkersWhenEmpty !==
        expectNode.onelineDiff.hasMarkersWhenEmpty
    ) {
      actualNode.onelineDiff.hasMarkersWhenEmpty =
        expectNode.onelineDiff.hasMarkersWhenEmpty = true;
    }
    return { result: "" };
  }
  return { result: "" };
};

const customExpectationSymbol = Symbol.for("jsenv_assert_custom_expectation");
const createCustomExpectation = (name, props) => {
  return {
    [Symbol.toStringTag]: name,
    [customExpectationSymbol]: true,
    group: "custom_expectation",
    subgroup: name,
    ...props,
  };
};
const createAssertMethodCustomExpectation = (
  methodName,
  args,
  {
    isRecomparison,
    customCompare = createAssertMethodCustomCompare(
      (actualNode, expectArgValueNode, { subcompareDuo }) => {
        const expectArgComparison = subcompareDuo(
          actualNode,
          expectArgValueNode,
          {
            isRecomparison,
          },
        );
        if (expectArgComparison.hasAnyDiff) {
          return PLACEHOLDER_FOR_MODIFIED;
        }
        return PLACEHOLDER_FOR_SAME;
      },
    ),
    renderOnlyArgs,
  } = {},
) => {
  return createCustomExpectation(`assert.${methodName}`, {
    parse: (node) => {
      node.childGenerator = () => {
        node.appendChild(
          "assert_method_call",
          createMethodCallNode(node, {
            objectName: "assert",
            methodName,
            args,
            renderOnlyArgs,
          }),
        );
      };
    },
    customCompare,
    render: (node, props) => {
      let diff = "";
      const assertMethodCallNode = node.childNodeMap.get("assert_method_call");
      if (renderOnlyArgs) {
        const argEntriesNode = assertMethodCallNode.childNodeMap.get("args");
        argEntriesNode.startMarker = "";
        argEntriesNode.endMarker = "";
        diff += argEntriesNode.render(props);
      } else {
        diff += assertMethodCallNode.render(props);
      }
      return diff;
    },
  });
};
const createValueCustomCompare = (customComparer) => {
  return (actualNode, expectNode, { onSelfDiff, subcompareChildrenSolo }) => {
    const selfDiff = customComparer(actualNode, expectNode);
    if (selfDiff) {
      onSelfDiff(selfDiff);
      subcompareChildrenSolo(actualNode, PLACEHOLDER_FOR_MODIFIED);
      return;
    }
    subcompareChildrenSolo(actualNode, PLACEHOLDER_FOR_SAME);
  };
};
const createAssertMethodCustomCompare = (
  customComparer,
  { argsCanBeComparedInParallel } = {},
) => {
  return (actualNode, expectNode, options) => {
    // prettier-ignore
    const assertMethod = expectNode.childNodeMap.get("assert_method_call");
    const argEntriesNode = assertMethod.childNodeMap.get("args");
    const childNodeKeys = Array.from(argEntriesNode.childNodeMap.keys());
    if (childNodeKeys.length === 0) {
      return;
    }
    if (childNodeKeys.length === 1) {
      const expectFirsArgValueNode = argEntriesNode.childNodeMap.get(0);
      expectFirsArgValueNode.ignore = true;
      const customComparerResult = customComparer(
        actualNode,
        expectFirsArgValueNode,
        options,
      );
      options.subcompareSolo(expectNode, customComparerResult);
      return;
    }
    const argIterator = argEntriesNode.childNodeMap[Symbol.iterator]();
    function* argValueGenerator() {
      let argIteratorResult;
      while ((argIteratorResult = argIterator.next())) {
        if (argIteratorResult.done) {
          break;
        }
        yield argIteratorResult.value[1];
      }
    }
    let result = PLACEHOLDER_FOR_SAME;
    for (const argValueNode of argValueGenerator()) {
      argValueNode.ignore = true;
      const customComparerResult = customComparer(
        actualNode,
        argValueNode,
        options,
      );
      if (customComparerResult === PLACEHOLDER_FOR_SAME) {
        continue;
      }
      result = customComparerResult;
      if (argsCanBeComparedInParallel) {
        continue;
      }
      for (const remainingArgValueNode of argValueGenerator()) {
        remainingArgValueNode.ignore = true;
        options.subcompareSolo(customComparerResult, remainingArgValueNode);
      }
      break;
    }
    options.subcompareSolo(expectNode, result);
    return;
  };
};

let createRootNode;
/*
 * Node represent any js value.
 * These js value are compared and converted to a readable string
 * Node art part of a tree structure (parent/children) and contains many
 * information about the value such as
 * - Is it a primitive or a composite?
 * - Where does the value come from?
 *   - property key
 *   - property value
 *   - prototype value returned by Object.getPrototypeOf()
 *   - a map entry key
 * - And finally info useful to render the js value into a readable string
 */
{
  createRootNode = ({ context, value, render }) => {
    /*
     * Il est possible pour actual de ref des valeurs de expect et inversement tel que
     * - Object.prototype
     * - Un ancetre commun
     * - Peu importe en fait
     * Il est aussi possible de découvrir une ref dans l'un plus tot que dans l'autre
     * (l'ordre des prop des object n'est pas garanti nottament)
     * Pour cette raison il y a un referenceMap par arbre (actual/expect)
     * Au final on regardera juste le path ou se trouve une ref pour savoir si elle sont les meme
     *
     * Une ref peut etre découverte apres
     * - ordre des props
     * - caché par maxColumns
     * - caché par MAX_ENTRY_BEFORE_MULTILINE_DIFF
     * - ...
     * Et que la découverte lazy des child (childGenerator) ne garantie pas de trouver la ref
     * des le départ
     * ALORS
     * On ne peut pas utiliser la notation suivante:
     * actual: {
     *   a: <ref #1> { toto: true },
     *   b: <ref #1>
     * }
     * expect: {
     *   a: <ref #1> { toto: true },
     *   b: <ref #1>
     * }
     *
     * on va lui préférer:
     * actual: {
     *   a: { toto: true },
     *   b: actual.a,
     * }
     * expect: {
     *   a: { toto: true },
     *   b: expect.a,
     * }
     */

    const referenceMap = new Map();
    let nodeId = 1;

    const rootNode = createNode({
      context,
      id: nodeId,
      group: "root",
      value,
      parent: null,
      depth: 0,
      path: createValuePath([
        {
          type: "identifier",
          value: context.name,
        },
      ]),
      render,
      referenceMap,
      nextId: () => {
        nodeId++;
        return nodeId;
      },
    });

    return rootNode;
  };

  const createNode = ({
    context,
    group,
    subgroup = group,
    category = group,
    value,
    key,
    parent,
    referenceMap,
    nextId,
    depth,
    path,
    childGenerator,
    isSourceCode = false,
    isFunctionPrototype = false,
    isClassPrototype = false,
    isRegexpSource = false,
    isStringForUrl = false,
    isStringForDate = false,
    isBody = false,
    customCompare,
    render,
    isHidden = false,
    isHiddenWhenSame = false,
    isHiddenWhenSolo = false,
    focusedChildIndex,
    startMarker = "",
    endMarker = "",
    quoteMarkerRef,
    separatorMarker = "",
    separatorMarkerDisabled = false,
    separatorMarkerWhenTruncated,
    hasLeftSpacingDisabled = false,
    hasRightSpacingDisabled = false,
    quotesDisabled = false,
    quotesBacktickDisabled = false,
    numericSeparatorsDisabled = false,
    lineNumbersDisabled = false,
    urlStringDetectionDisabled = false,
    dateStringDetectionDisabled = false,
    preserveLineBreaks = false,
    renderOptions = renderOptionsDefault,
    onelineDiff = null,
    multilineDiff = null,
    stringDiffPrecision = "per_line_and_per_char",
    isStandaloneDiff = false,
  }) => {
    const node = {
      context,
      value,
      key,
      group,
      subgroup,
      category,
      childGenerator,
      childNodeMap: null,
      appendChild: (childKey, params) =>
        appendChildNodeGeneric(node, childKey, params),
      wrappedNodeGetter: () => {},
      parent,
      reference: null,
      referenceMap,
      nextId,
      depth,
      path,
      isSourceCode,
      isClassPrototype,
      isRegexpSource,
      isStringForUrl,
      isStringForDate,
      isBody,
      isStandaloneDiff,
      // info
      isCustomExpectation: false,
      // info/primitive
      isUndefined: false,
      isString: false,
      isNumber: false,
      isNegativeZero: false,
      isInfinity: false,
      isNaN: false,
      isBigInt: false,
      isSymbol: false,
      // info/composite
      isFunction: false,
      functionAnalysis: defaultFunctionAnalysis,
      objectTag: "",
      isArray: false,
      isTypedArray: false,
      isMap: false,
      isSet: false,
      isURL: false,
      isURLSearchParams: false,
      isHeaders: false,
      isDate: false,
      isError: false,
      isRegExp: false,
      isPromise: false,
      isRequest: false,
      isResponse: false,
      isAbortController: false,
      isAbortSignal: false,
      isStringObject: false,
      referenceFromOthersSet: referenceFromOthersSetDefault,
      // render info
      render: (props) => render(node, props),
      isHidden,
      isHiddenWhenSame,
      isHiddenWhenSolo,
      focusedChildIndex,
      beforeRender: null,
      // START will be set by comparison
      customCompare,
      ignore: false,
      comparison: null,
      childComparisonDiffMap: null,
      childrenKeys: null,
      childrenRenderRange: null,
      firstChildWithDiffKey: undefined,
      rangeToDisplay: null,
      displayedRange: null,
      childKeyToDisplaySet: null,
      maxDiffReached: false,
      diffType: "",
      otherNode: null,
      // END will be set by comparison
      startMarker,
      endMarker,
      quoteMarkerRef,
      separatorMarker,
      separatorMarkerDisabled,
      separatorMarkerWhenTruncated,
      hasLeftSpacingDisabled,
      hasRightSpacingDisabled,
      renderOptions,
      onelineDiff,
      multilineDiff,
      color: "",
    };
    child_node_map: {
      const childNodeMap = new Map();
      let childrenGenerated = false;
      const generateChildren = () => {
        if (childrenGenerated) {
          return;
        }
        childrenGenerated = true;
        if (!node.childGenerator) {
          return;
        }
        node.childGenerator(node);
        node.childGenerator = null;
      };
      node.childNodeMap = new Proxy(childNodeMap, {
        has: (target, prop, receiver) => {
          if (!childrenGenerated) {
            generateChildren();
          }
          let value = Reflect.has(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
        get: (target, prop, receiver) => {
          if (!childrenGenerated) {
            generateChildren();
          }
          if (prop === "size") {
            return target[prop];
          }
          let value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    }
    Object.preventExtensions(node);
    if (value && value[customExpectationSymbol]) {
      const { parse, render, customCompare, group, subgroup } = value;
      node.isCustomExpectation = true;
      if (parse) {
        parse(node);
      }
      node.customCompare = customCompare;
      node.render = (props) => render(node, props);
      node.group = group;
      node.subgroup = subgroup;
      return node;
    }
    if (category === "reference") {
      return node;
    }
    if (
      value === SOURCE_CODE_ENTRY_KEY ||
      value === VALUE_OF_RETURN_VALUE_ENTRY_KEY ||
      value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY
    ) {
      node.category = "primitive";
      node.isString = true;
      return node;
    }
    if (group === "entries") {
      return node;
    }
    if (group === "entry") {
      return node;
    }
    // if (group === "part") {
    //   return node;
    // }
    if (subgroup === "array_entry_key" || subgroup === "arg_entry_key") {
      node.category = "primitive";
      node.isNumber = true;
      return node;
    }
    if (subgroup === "char") {
      node.category = "primitive";
      node.isString = true;
      return node;
    }
    if (subgroup === "url_search_entry") {
      node.category = "composite";
      return node;
    }
    if (value === null) {
      node.category = "primitive";
      return node;
    }
    if (value === undefined) {
      node.category = "primitive";
      node.isUndefined = true;
      return node;
    }
    const typeofResult = typeof value;
    if (typeofResult === "number") {
      node.category = "primitive";
      node.isNumber = true;
      if (getIsNegativeZero(value)) {
        node.isNegativeZero = true;
      }
      // eslint-disable-next-line no-self-compare
      if (value !== value) {
        node.isNaN = true;
      }
      if (value === Infinity || value === -Infinity) {
        node.isInfinity = true;
      }
      node.childGenerator = () => {
        const numberCompositionNode = node.appendChild("composition", {
          value,
          render: renderChildren,
          onelineDiff: {},
          startMarker: node.startMarker,
          endMarker: node.endMarker,
          group: "entries",
          subgroup: "number_composition",
          childGenerator: () => {
            if (node.isNaN) {
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: "NaN",
              });
              return;
            }
            if (node.isNegativeZero || Math.sign(value) === -1) {
              numberCompositionNode.appendChild("sign", {
                ...getGrammarProps(),
                group: "number_sign",
                value: "-",
              });
            }
            if (node.isNegativeZero) {
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: "0",
              });
              return;
            }
            if (node.isInfinity) {
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: "Infinity",
              });
              return;
            }
            // integer
            if (value % 1 === 0) {
              const { integer } = tokenizeInteger(Math.abs(value));
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: numericSeparatorsDisabled
                  ? integer
                  : groupDigits(integer),
              });
              return;
            }
            // float
            const { integer, decimalSeparator, decimal } = tokenizeFloat(
              Math.abs(value),
            );
            numberCompositionNode.appendChild("integer", {
              ...getGrammarProps(),
              group: "integer",
              value: numericSeparatorsDisabled ? integer : groupDigits(integer),
              separatorMarker: decimalSeparator,
            });
            numberCompositionNode.appendChild("decimal", {
              ...getGrammarProps(),
              group: "decimal",
              value: numericSeparatorsDisabled ? decimal : groupDigits(decimal),
            });
          },
        });
      };
      return node;
    }
    if (typeofResult === "bigint") {
      node.category = "primitive";
      node.isBigInt = true;
      return node;
    }
    if (typeofResult === "string") {
      node.category = "primitive";
      node.isString = true;
      if (!quoteMarkerRef && !quotesDisabled) {
        node.quoteMarkerRef = quoteMarkerRef = {
          current: pickBestQuote(value, { quotesBacktickDisabled }),
        };
      }
      if (
        !isStringForUrl &&
        !urlStringDetectionDisabled &&
        canParseUrl(value)
      ) {
        node.isStringForUrl = isStringForUrl = true;
      }
      if (isStringForUrl) {
        node.childGenerator = () => {
          const urlObject = new URL(value);
          const urlPartsNode = node.appendChild("parts", {
            value,
            category: "url_parts",
            group: "entries",
            subgroup: "url_parts",
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true,
              skippedMarkers: {
                start: "…",
                between: "…",
                end: "…",
              },
            },
            startMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            endMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            quoteMarkerRef,
            childGenerator() {
              const {
                protocol,
                username,
                password,
                hostname,
                port,
                pathname,
                search,
                hash,
              } = urlObject;
              const appendUrlPartNode = (name, value, params) => {
                urlPartsNode.appendChild(name, {
                  value,
                  render: renderValue,
                  urlStringDetectionDisabled: true,
                  preserveLineBreaks: true,
                  quoteMarkerRef,
                  quotesDisabled: true,
                  group: "url_part",
                  subgroup: `url_${name}`,
                  ...params,
                });
              };

              appendUrlPartNode("protocol", protocol, {
                endMarker: "//",
              });

              if (username) {
                appendUrlPartNode("username", decodeURIComponent(username), {
                  endMarker: password ? ":" : "@",
                });
                if (password) {
                  appendUrlPartNode("password", decodeURIComponent(password), {
                    endMarker: "@",
                  });
                }
              }
              if (hostname) {
                appendUrlPartNode("hostname", decodeURIComponent(hostname));
              }

              if (port) {
                appendUrlPartNode("port", parseInt(port), {
                  startMarker: ":",
                  numericSeparatorsDisabled: true,
                });
              }
              if (pathname) {
                appendUrlPartNode("pathname", decodeURIComponent(pathname));
              }
              if (search) {
                const urlSearchNode = urlPartsNode.appendChild("search", {
                  value: null,
                  render: renderChildren,
                  startMarker: "?",
                  onelineDiff: {
                    hasTrailingSeparator: true,
                  },
                  group: "entries",
                  subgroup: "url_search",
                  childGenerator() {
                    const searchParamsMap = tokenizeUrlSearch(search);
                    let searchEntryIndex = 0;
                    for (const [key, values] of searchParamsMap) {
                      const urlSearchEntryNode = urlSearchNode.appendChild(
                        key,
                        {
                          key: searchEntryIndex,
                          render: renderChildren,
                          onelineDiff: {
                            hasTrailingSeparator: true,
                          },
                          path: node.path.append(key),
                          group: "entries",
                          subgroup: "url_search_entry",
                          childGenerator() {
                            let valueIndex = 0;
                            const isMultiValue = values.length > 1;
                            while (valueIndex < values.length) {
                              const urlSearchEntryPartNode =
                                urlSearchEntryNode.appendChild(valueIndex, {
                                  key,
                                  render: renderChildren,
                                  onelineDiff: {
                                    hasTrailingSeparator: true,
                                  },
                                  group: "entry",
                                  subgroup: "url_search_value_entry",
                                  path: isMultiValue
                                    ? urlSearchEntryNode.path.append(
                                        valueIndex,
                                        { isIndexedEntry: true },
                                      )
                                    : undefined,
                                });
                              urlSearchEntryPartNode.appendChild("entry_key", {
                                value: key,
                                render: renderString,
                                stringDiffPrecision: "none",
                                startMarker:
                                  urlSearchEntryNode.key === 0 &&
                                  valueIndex === 0
                                    ? ""
                                    : "&",
                                separatorMarker: "=",
                                separatorMarkerWhenTruncated: "",
                                quoteMarkerRef,
                                quotesDisabled: true,
                                urlStringDetectionDisabled: true,
                                dateStringDetectionDisabled: true,
                                preserveLineBreaks: true,
                                group: "entry_key",
                                subgroup: "url_search_entry_key",
                              });
                              urlSearchEntryPartNode.appendChild(
                                "entry_value",
                                {
                                  value: values[valueIndex],
                                  render: renderString,
                                  stringDiffPrecision: "none",
                                  quoteMarkerRef,
                                  quotesDisabled: true,
                                  urlStringDetectionDisabled: true,
                                  dateStringDetectionDisabled: true,
                                  preserveLineBreaks: true,
                                  group: "entry_value",
                                  subgroup: "url_search_entry_value",
                                },
                              );
                              valueIndex++;
                            }
                          },
                        },
                      );
                      searchEntryIndex++;
                    }
                  },
                });
              }
              if (hash) {
                appendUrlPartNode("hash", decodeURIComponent(hash));
              }
            },
          });
        };
        return node;
      }
      if (
        !isStringForDate &&
        !dateStringDetectionDisabled &&
        canParseDate(value)
      ) {
        node.isStringForDate = isStringForDate = true;
      }
      if (isStringForDate) {
        node.childGenerator = () => {
          const dateString = value;
          let dateTimestamp = Date.parse(dateString);
          const hasTimezone = usesTimezone(dateString);
          if (hasTimezone) {
            const dateObjectUsingSystemTimezone = new Date(dateTimestamp);
            dateTimestamp +=
              dateObjectUsingSystemTimezone.getTimezoneOffset() * 60_000;
          }
          const dateObject = new Date(dateTimestamp);

          const datePartsNode = node.appendChild("parts", {
            value: `${dateTimestamp}${hasTimezone ? "Z" : ""}`,
            category: "date_parts",
            group: "entries",
            subgroup: "date_parts",
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true,
              skippedMarkers: {
                start: "…",
                between: "…",
                end: "…",
              },
            },
            startMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            endMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            quoteMarkerRef,
            childGenerator: () => {
              const appendDatePartNode = (name, value, params, width) => {
                return datePartsNode.appendChild(name, {
                  group: "date_part",
                  subgroup: `date_${name}`,
                  value,
                  render: (node, props) => {
                    return truncateAndApplyColor(
                      String(value).padStart(width, "0"),
                      node,
                      props,
                    );
                  },
                  ...params,
                });
              };
              appendDatePartNode("year", dateObject.getFullYear());
              appendDatePartNode(
                "month",
                dateObject.getMonth() + 1,
                { startMarker: "-" },
                2,
              );
              appendDatePartNode(
                "day",
                dateObject.getDate(),
                { startMarker: "-" },
                2,
              );
              const timePartsNode = datePartsNode.appendChild("time", {
                group: "entries",
                subgroup: "date_time",
                render: renderChildren,
                onelineDiff: {},
                isHiddenWhenSame: true,
                childGenerator: () => {
                  const appendTimePartNode = (name, value, params, width) => {
                    return timePartsNode.appendChild(name, {
                      group: "time_prop",
                      subgroup: `time_${name}`,
                      value,
                      render: (node, props) => {
                        return truncateAndApplyColor(
                          width ? String(value).padStart(width, "0") : value,
                          node,
                          props,
                        );
                      },
                      ...params,
                    });
                  };
                  appendTimePartNode(
                    "hours",
                    dateObject.getHours(),
                    { startMarker: " " },
                    2,
                  );
                  appendTimePartNode(
                    "minutes",
                    dateObject.getMinutes(),
                    { startMarker: ":" },
                    2,
                  );
                  appendTimePartNode(
                    "seconds",
                    dateObject.getSeconds(),
                    { startMarker: ":" },
                    2,
                  );
                  appendTimePartNode(
                    "milliseconds",
                    dateObject.getMilliseconds(),
                    {
                      startMarker: ".",
                      isHiddenWhenSame: true,
                    },
                    3,
                  );
                  if (hasTimezone) {
                    appendTimePartNode("timezone", "Z");
                  }
                },
              });
            },
          });
        };
        return node;
      }
      if (stringDiffPrecision === "per_line_and_per_char") {
        node.childGenerator = () => {
          const lineEntriesNode = node.appendChild("parts", {
            value,
            category: "line_parts",
            group: "entries",
            subgroup: "line_entries",
            render: renderChildrenMultiline,
            multilineDiff: {
              hasTrailingSeparator: true,
              skippedMarkers: {
                start: ["↑ 1 line ↑", "↑ {x} lines ↑"],
                between: ["↕ 1 line ↕", "↕ {x} lines ↕"],
                end: ["↓ 1 line ↓", "↓ {x} lines ↓"],
              },
              maxDiffType: "line",
              lineNumbersDisabled,
            },
            startMarker: node.startMarker,
            endMarker: node.endMarker,
            quoteMarkerRef,
            childGenerator: () => {
              let isMultiline = node.context.forceMultilineDiff;
              const appendLineEntry = (lineIndex) => {
                const lineNode = lineEntriesNode.appendChild(lineIndex, {
                  value: "",
                  key: lineIndex,
                  render: renderChildren,
                  onelineDiff: {
                    focusedChildWhenSame: "first",
                    skippedMarkers: {
                      start: "…",
                      between: "…",
                      end: "…",
                    },
                    skippedMarkersPlacement: isMultiline ? "inside" : "outside",
                    childrenVisitMethod: "all_before_then_all_after",
                  },
                  // When multiline string appear as property value
                  // 1. It becomes hard to see if "," is part of the string or the separator
                  // 2. "," would appear twice if multiline string ends with ","
                  // {
                  //   foo: 1| line 1
                  //        2| line 2,,
                  //   bar: true,
                  // }
                  // Fortunately the line break already helps to split properties (foo and bar)
                  // so the following is readable
                  // {
                  //   foo: 1| line 1
                  //        2| line 2,
                  //   bar: true,
                  // }
                  // -> The separator is not present for multiline
                  group: "entries",
                  subgroup: "line_entry_value",
                });
                const appendCharNode = (charIndex, char) => {
                  lineNode.value += char; // just for debug purposes
                  lineNode.appendChild(charIndex, {
                    key: charIndex,
                    value: char,
                    render: renderChar,
                    renderOptions: isRegexpSource
                      ? { stringCharMapping: null }
                      : undefined,
                    quoteMarkerRef,
                    group: "entry_value",
                    subgroup: "char",
                  });
                };
                return {
                  node: lineNode,
                  appendCharNode,
                };
              };
              const chars = node.context.tokenizeString(value);
              let currentLineEntry = appendLineEntry(0);
              let lineIndex = 0;
              let charIndex = 0;
              for (const char of chars) {
                if (char === "\n" && !preserveLineBreaks) {
                  isMultiline = true;
                  lineIndex++;
                  charIndex = 0;
                  currentLineEntry = appendLineEntry(lineIndex);
                  continue;
                }
                currentLineEntry.appendCharNode(charIndex, char);
                charIndex++;
              }
              if (isMultiline) {
                enableMultilineDiff(lineEntriesNode);
              } else {
                const firstLineNode = currentLineEntry.node;
                if (!quotesDisabled && quoteMarkerRef.current) {
                  firstLineNode.onelineDiff.hasMarkersWhenEmpty = true;
                  firstLineNode.startMarker = firstLineNode.endMarker =
                    quoteMarkerRef.current;
                }
              }
            },
          });
        };
        return node;
      }
      if (!quotesDisabled) {
        node.startMarker = quoteMarkerRef.current;
        node.endMarker = quoteMarkerRef.current;
      }
      return node;
    }
    if (typeofResult === "symbol") {
      node.category = "primitive";
      node.isSymbol = true;
      node.childGenerator = () => {
        const wellKnownPath = node.context.getWellKnownValuePath(value);
        if (wellKnownPath) {
          const wellKnownNode = node.appendChild("well_known", {
            value: wellKnownPath,
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true,
            },
            category: "well_known",
            group: "entries",
            subgroup: "well_known",
            childGenerator() {
              let index = 0;
              for (const part of wellKnownPath) {
                wellKnownNode.appendChild(index, {
                  ...getGrammarProps(),
                  group: "path",
                  value: part.value,
                });
                index++;
              }
            },
          });
          return;
        }

        const symbolKey = Symbol.keyFor(value);
        if (symbolKey) {
          node.appendChild(
            "symbol_construct",
            createMethodCallNode(node, {
              objectName: "Symbol",
              methodName: "for",
              args: [
                {
                  value: symbolKey,
                },
              ],
            }),
          );
          return;
        }
        const description = symbolToDescription(value);
        node.appendChild(
          "symbol_construct",
          createMethodCallNode(node, {
            objectName: "Symbol",
            args: description
              ? [
                  {
                    value: symbolToDescription(value),
                  },
                ]
              : [],
          }),
        );
      };
      return node;
    }
    const isObject = typeofResult === "object";
    const isFunction = typeofResult === "function";
    if (isObject || isFunction) {
      node.category = "composite";
      node.referenceFromOthersSet = new Set();
      const reference = node.referenceMap.get(value);
      if (reference) {
        node.reference = reference;
        reference.referenceFromOthersSet.add(node);
      } else {
        node.referenceMap.set(value, node);
      }
      if (isFunction) {
        node.isFunction = true;
        node.functionAnalysis = tokenizeFunction(value);
      }
      for (const proto of objectPrototypeChainGenerator(value)) {
        const parentConstructor = proto.constructor;
        if (!parentConstructor) {
          continue;
        }
        if (parentConstructor.name === "Map") {
          node.isMap = true;
          continue;
        }
        if (parentConstructor.name === "Array") {
          node.isArray = true;
          continue;
        }
        if (parentConstructor.name === "Set") {
          node.isSet = true;
          continue;
        }
        if (parentConstructor.name === "URL") {
          node.isURL = true;
          continue;
        }
        if (parentConstructor.name === "URLSearchParams") {
          node.isURLSearchParams = true;
          continue;
        }
        if (parentConstructor.name === "Headers") {
          node.isHeaders = true;
          continue;
        }
        if (parentConstructor.name === "Date") {
          node.isDate = true;
          continue;
        }
        if (parentConstructor.name === "RegExp") {
          node.isRegExp = true;
          continue;
        }
        if (parentConstructor.name === "Promise") {
          node.isPromise = true;
          continue;
        }
        if (parentConstructor.name === "Request") {
          node.isRequest = true;
          continue;
        }
        if (parentConstructor.name === "Response") {
          node.isResponse = true;
          continue;
        }
        if (parentConstructor.name === "AbortController") {
          node.isAbortController = true;
          continue;
        }
        if (parentConstructor.name === "AbortSignal") {
          node.isAbortSignal = true;
          continue;
        }
        if (parentConstructor.name === "String") {
          node.isStringObject = true;
          continue;
        }
        if (
          // "Int8Array",
          // "Uint8Array",
          // "Uint8ClampedArray",
          // "Int16Array",
          // "Uint16Array",
          // "Int32Array",
          // "Uint32Array",
          // "Float32Array",
          // "Float64Array",
          // "BigInt64Array",
          // "BigUint64Array",
          parentConstructor.name === "TypedArray"
        ) {
          node.isTypedArray = true;
          continue;
        }
        if (parentConstructor.name === "Error") {
          node.isError = true;
          continue;
        }
      }
      let isFrozen = false;
      let isSealed = false;
      let isExtensible = true;
      if (Object.isFrozen(value)) {
        isFrozen = true;
      } else if (Object.isSealed(value)) {
        isSealed = true;
      } else if (!Object.isExtensible(value)) {
        isExtensible = false;
      }
      const wellKnownPath = node.context.getWellKnownValuePath(value);
      if (
        node.reference ||
        wellKnownPath ||
        node.isFunction ||
        isFunctionPrototype
      ) {
      } else {
        node.objectTag = getObjectTag(value);
      }

      node.childGenerator = function () {
        if (wellKnownPath) {
          const wellKnownNode = node.appendChild("well_known", {
            value: wellKnownPath,
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true,
            },
            category: "well_known",
            group: "entries",
            subgroup: "well_known",
            childGenerator() {
              let index = 0;
              for (const part of wellKnownPath) {
                wellKnownNode.appendChild(index, {
                  ...getGrammarProps(),
                  group: "path",
                  value: part.value,
                });
                index++;
              }
            },
          });
          return;
        }
        if (node.reference) {
          const referenceNode = node.appendChild("reference", {
            value: node.reference.path,
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true,
            },
            category: "reference",
            group: "entries",
            subgroup: "reference",
            childGenerator() {
              let index = 0;
              for (const path of node.reference.path) {
                referenceNode.appendChild(index, {
                  ...getGrammarProps(),
                  group: "path",
                  value: path.value,
                });
                index++;
              }
            },
          });
          return;
        }

        const compositePartsNode = node.appendChild("parts", {
          category: "composite_parts",
          render: renderChildren,
          onelineDiff: {
            hasSpacingBetweenEachChild: true,
            hasTrailingSeparator: true,
          },
          childGenerator: () => {
            const ownPropertyNameToIgnoreSet = new Set();
            const ownPropertSymbolToIgnoreSet = new Set();
            const propertyLikeCallbackSet = new Set();
            const propertyConverterMap = new Map();
            const objectIntegrityMethodName = isFrozen
              ? "freeze"
              : isSealed
                ? "seal"
                : isExtensible
                  ? ""
                  : "preventExtensions";
            if (objectIntegrityMethodName) {
              const objectIntegrityNode = compositePartsNode.appendChild(
                "object_integrity",
                {
                  value: null,
                  render: renderChildren,
                  onelineDiff: {
                    hasTrailingSeparator: true,
                  },
                  hasRightSpacingDisabled: true,
                  group: "entries",
                  subgroup: "object_integrity",
                  childGenerator: () => {
                    objectIntegrityNode.appendChild("object_name", {
                      ...getGrammarProps(),
                      value: "Object",
                      separatorMarker: ".",
                    });
                    objectIntegrityNode.appendChild("method_name", {
                      ...getGrammarProps(),
                      value: objectIntegrityMethodName,
                      separatorMarker: "(",
                    });
                  },
                },
              );
            }
            let objectConstructNode = null;
            let objectConstructArgs = null;
            construct: {
              if (node.isFunction) {
                ownPropertyNameToIgnoreSet.add("length");
                ownPropertyNameToIgnoreSet.add("name");
                const functionConstructNode = compositePartsNode.appendChild(
                  "construct",
                  {
                    value: null,
                    render: renderChildren,
                    onelineDiff: {
                      hasSpacingBetweenEachChild: true,
                    },
                    group: "entries",
                    subgroup: "function_construct",
                    childGenerator() {
                      if (node.functionAnalysis.type === "class") {
                        functionConstructNode.appendChild("class_keyword", {
                          ...getGrammarProps(),
                          group: "class_keyword",
                          value: "class",
                        });
                        if (node.functionAnalysis.name) {
                          functionConstructNode.appendChild("function_name", {
                            ...getGrammarProps(),
                            group: "function_name",
                            value: node.functionAnalysis.name,
                          });
                        }
                        const extendedClassName =
                          node.functionAnalysis.extendedClassName;
                        if (extendedClassName) {
                          functionConstructNode.appendChild(
                            "class_extends_keyword",
                            {
                              ...getGrammarProps(),
                              group: "class_extends_keyword",
                              value: "extends",
                            },
                          );
                          functionConstructNode.appendChild(
                            "class_extended_name",
                            {
                              ...getGrammarProps(),
                              group: "class_extended_name",
                              value: extendedClassName,
                            },
                          );
                        }
                        return;
                      }
                      if (node.functionAnalysis.isAsync) {
                        functionConstructNode.appendChild(
                          "function_async_keyword",
                          {
                            ...getGrammarProps(),
                            group: "function_async_keyword",
                            value: "async",
                          },
                        );
                      }
                      if (node.functionAnalysis.type === "classic") {
                        functionConstructNode.appendChild("function_keyword", {
                          ...getGrammarProps(),
                          group: "function_keyword",
                          value: node.functionAnalysis.isGenerator
                            ? "function*"
                            : "function",
                        });
                      }
                      if (node.functionAnalysis.name) {
                        functionConstructNode.appendChild("function_name", {
                          ...getGrammarProps(),
                          group: "function_name",
                          value: node.functionAnalysis.name,
                        });
                      }
                      function_body_prefix: {
                        const appendFunctionBodyPrefix = (prefix) => {
                          functionConstructNode.appendChild(
                            "function_body_prefix",
                            {
                              ...getGrammarProps(),
                              group: "function_body_prefix",
                              value: prefix,
                            },
                          );
                        };

                        if (node.functionAnalysis.type === "arrow") {
                          appendFunctionBodyPrefix("() =>");
                        } else if (node.functionAnalysis.type === "method") {
                          let methodName;
                          if (node.subgroup === "property_descriptor_value") {
                            methodName = node.parent.parent.key;
                          } else {
                            methodName = key;
                          }
                          if (node.functionAnalysis.getterName) {
                            appendFunctionBodyPrefix(`get ${methodName}()`);
                          } else if (node.functionAnalysis.setterName) {
                            appendFunctionBodyPrefix(`set ${methodName}()`);
                          } else {
                            appendFunctionBodyPrefix(`${methodName}()`);
                          }
                        } else if (node.functionAnalysis.type === "classic") {
                          appendFunctionBodyPrefix("()");
                        }
                      }
                    },
                  },
                );
                break construct;
              }
              if (isFunctionPrototype) {
                break construct;
              }
              if (node.isError) {
                ownPropertyNameToIgnoreSet.add("stack");
                const messageOwnPropertyDescriptor =
                  Object.getOwnPropertyDescriptor(value, "message");
                if (messageOwnPropertyDescriptor) {
                  ownPropertyNameToIgnoreSet.add("message");
                }
                const errorConstructNode = compositePartsNode.appendChild(
                  "construct",
                  {
                    value: null,
                    render: renderChildren,
                    onelineDiff: {},
                    group: "entries",
                    subgroup: "error_construct",
                    focusedChildIndex: 0,
                    childGenerator: () => {
                      errorConstructNode.appendChild("error_constructor", {
                        ...getGrammarProps(),
                        value: node.objectTag,
                        separatorMarker: ": ",
                      });
                      if (messageOwnPropertyDescriptor) {
                        const errorMessage = messageOwnPropertyDescriptor.value;
                        errorConstructNode.appendChild("error_message", {
                          render: renderString,
                          group: "error_message",
                          value: errorMessage,
                          lineNumbersDisabled: true,
                          quotesDisabled: true,
                        });
                      }
                    },
                  },
                );
                break construct;
              }
              if (node.isRegExp) {
                let regexpSource = value.source;
                if (regexpSource === "(?:)") {
                  regexpSource = "";
                }
                regexpSource = `/${regexpSource}/${value.flags}`;
                compositePartsNode.appendChild("construct", {
                  value: regexpSource,
                  render: renderValue,
                  isRegexpSource: true,
                  quotesDisabled: true,
                  group: "regexp_source",
                  subgroup: "regexp_source",
                });
                break construct;
              }
              if (
                node.objectTag &&
                node.objectTag !== "Object" &&
                node.objectTag !== "Array"
              ) {
                objectConstructNode = compositePartsNode.appendChild(
                  "construct",
                  {
                    group: "entries",
                    subgroup: "object_construct",
                    value: null,
                    render: renderChildren,
                    onelineDiff: { hasSpacingBetweenEachChild: true },
                    childGenerator() {
                      if (objectConstructArgs) {
                        objectConstructNode.appendChild(
                          "call",
                          createMethodCallNode(objectConstructNode, {
                            objectName: node.objectTag,
                            args: objectConstructArgs,
                          }),
                        );
                      } else {
                        objectConstructNode.appendChild("object_tag", {
                          ...getGrammarProps(),
                          group: "object_tag",
                          path: node.path.append("[[ObjectTag]]"),
                          value: node.objectTag,
                        });
                      }
                    },
                  },
                );
                break construct;
              }
            }
            wrapped_value: {
              // toString()
              if (node.isURL) {
                objectConstructArgs = [
                  {
                    value: value.href,
                    key: "toString()",
                    isStringForUrl: true,
                  },
                ];
                break wrapped_value;
              }
              if (node.isDate) {
                objectConstructArgs = [
                  {
                    value: value.toISOString(),
                    key: "toString()",
                    isStringForDate: true,
                  },
                ];
                break wrapped_value;
              }
              if (node.isRequest) {
                const requestDefaultValues = {
                  body: null,
                  bodyUsed: false,
                  cache: "default",
                  credentials: "same-origin",
                  destination: "",
                  headers: undefined,
                  method: "GET",
                  mode: "cors",
                  priority: undefined,
                  redirect: "follow",
                  referrerPolicy: "",
                  referrer: "about:client",
                  signal: null,
                };
                const requestInitOptions = {};
                let hasCustomInit = false;
                for (const requestInternalPropertyName of Object.keys(
                  requestDefaultValues,
                )) {
                  const requestInternalPropertyValue =
                    value[requestInternalPropertyName];
                  if (requestInternalPropertyName === "headers") {
                    let headersAreEmpty = true;
                    // eslint-disable-next-line no-unused-vars
                    for (const entry of requestInternalPropertyValue) {
                      headersAreEmpty = false;
                      break;
                    }
                    if (headersAreEmpty) {
                      continue;
                    }
                  } else if (requestInternalPropertyName === "signal") {
                    if (!requestInternalPropertyValue.aborted) {
                      continue;
                    }
                  } else {
                    const requestInternalPropertyDefaultValue =
                      requestDefaultValues[requestInternalPropertyName];
                    if (
                      requestInternalPropertyValue ===
                      requestInternalPropertyDefaultValue
                    ) {
                      continue;
                    }
                  }
                  hasCustomInit = true;
                  requestInitOptions[requestInternalPropertyName] =
                    requestInternalPropertyValue;
                }

                objectConstructArgs = [
                  {
                    value: value.url,
                    key: "url",
                  },
                  ...(hasCustomInit ? [{ value: requestInitOptions }] : []),
                ];

                break wrapped_value;
              }
              if (node.isResponse) {
                const responseInitOptions = {};
                const bodyUsed = value.bodyUsed;
                if (bodyUsed) {
                  responseInitOptions.bodyUsed = true;
                }
                const headers = value.headers;
                let headersAreEmpty = true;
                // eslint-disable-next-line no-unused-vars
                for (const entry of headers) {
                  headersAreEmpty = false;
                  break;
                }
                if (!headersAreEmpty) {
                  responseInitOptions.headers = headers;
                }
                const status = value.status;
                responseInitOptions.status = status;
                const statusText = value.statusText;
                if (statusText !== "") {
                  responseInitOptions.statusText = statusText;
                }
                const url = value.url;
                if (url) {
                  responseInitOptions.url = url;
                }
                const type = value.type;
                if (type !== "default") {
                  responseInitOptions.type = type;
                }
                const redirected = value.redirected;
                if (redirected) {
                  responseInitOptions.redirected = redirected;
                }
                objectConstructArgs = [
                  {
                    value: value.body,
                    key: "body",
                    isBody: true,
                  },
                  ...(Object.keys(responseInitOptions).length
                    ? [{ value: responseInitOptions }]
                    : []),
                ];
                break wrapped_value;
              }
              // valueOf()
              const valueOf = value.valueOf;
              if (
                typeof valueOf === "function" &&
                valueOf !== Object.prototype.valueOf
              ) {
                if (objectConstructNode) {
                  ownPropertyNameToIgnoreSet.add("valueOf");
                  objectConstructArgs = [
                    {
                      value: valueOf.call(value),
                      key: "valueOf()",
                    },
                  ];
                  break wrapped_value;
                }
                if (Object.hasOwn(value, "valueOf")) {
                  propertyConverterMap.set("valueOf", () => {
                    return [
                      VALUE_OF_RETURN_VALUE_ENTRY_KEY,
                      valueOf.call(value),
                    ];
                  });
                } else {
                  propertyLikeCallbackSet.add((appendPropertyEntryNode) => {
                    appendPropertyEntryNode(
                      VALUE_OF_RETURN_VALUE_ENTRY_KEY,
                      valueOf.call(value),
                    );
                  });
                }
                break wrapped_value;
              }
            }
            symbol_to_primitive: {
              const toPrimitive = value[Symbol.toPrimitive];
              if (typeof toPrimitive !== "function") {
                break symbol_to_primitive;
              }
              if (
                node.isDate &&
                toPrimitive === Date.prototype[Symbol.toPrimitive]
              ) {
                break symbol_to_primitive;
              }
              if (objectConstructNode && !objectConstructArgs) {
                ownPropertSymbolToIgnoreSet.add(Symbol.toPrimitive);
                objectConstructArgs = [
                  {
                    value: toPrimitive.call(value, "string"),
                    key: "toPrimitive()",
                  },
                ];
              } else if (Object.hasOwn(value, Symbol.toPrimitive)) {
                propertyConverterMap.set(Symbol.toPrimitive, () => {
                  return [
                    SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY,
                    toPrimitive.call(value, "string"),
                  ];
                });
              } else {
                propertyLikeCallbackSet.add((appendPropertyEntryNode) => {
                  appendPropertyEntryNode(
                    SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY,
                    toPrimitive.call(value, "string"),
                  );
                });
              }
            }
            internal_entries: {
              const internalEntriesParams = {
                render: renderChildrenMultilineWhenDiff,
                startMarker: "(",
                endMarker: ")",
                onelineDiff: {
                  hasMarkersWhenEmpty: true,
                  hasSpacingBetweenEachChild: true,
                },
                multilineDiff: {
                  hasMarkersWhenEmpty: true,
                  hasTrailingSeparator: true,
                  hasNewLineAroundChildren: true,
                  hasIndentBeforeEachChild: true,
                  skippedMarkers: {
                    start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                    between: ["↕ 1 value ↕", "↕ {x} values ↕"],
                    end: ["↓ 1 value ↓", "↓ {x} values ↓"],
                  },
                  maxDiffType: "prop",
                },
                hasLeftSpacingDisabled: true,
                group: "entries",
              };
              if (node.isMap) {
                const mapEntriesNode = compositePartsNode.appendChild(
                  "internal_entries",
                  {
                    ...internalEntriesParams,
                    subgroup: "map_entries",
                    childGenerator: () => {
                      const objectTagCounterMap = new Map();
                      for (const [mapEntryKey, mapEntryValue] of value) {
                        let pathPart;
                        if (isComposite(mapEntryKey)) {
                          const keyObjectTag = getObjectTag(mapEntryKey);
                          if (objectTagCounterMap.has(keyObjectTag)) {
                            const objectTagCount =
                              objectTagCounterMap.get(keyObjectTag) + 1;
                            objectTagCounterMap.set(
                              keyObjectTag,
                              objectTagCount,
                            );
                            pathPart = `${keyObjectTag}#${objectTagCount}`;
                          } else {
                            objectTagCounterMap.set(keyObjectTag, 1);
                            pathPart = `${keyObjectTag}#1`;
                          }
                        } else {
                          pathPart = String(mapEntryKey);
                        }

                        const mapEntryNode = mapEntriesNode.appendChild(
                          mapEntryKey,
                          {
                            key: mapEntryKey,
                            render: renderChildren,
                            onelineDiff: {
                              hasTrailingSeparator: true,
                            },
                            group: "entry",
                            subgroup: "map_entry",
                            path: node.path.append(pathPart),
                          },
                        );
                        mapEntryNode.appendChild("entry_key", {
                          value: mapEntryKey,
                          render: renderValue,
                          separatorMarker: " => ",
                          group: "entry_key",
                          subgroup: "map_entry_key",
                          isStandaloneDiff: true,
                        });
                        mapEntryNode.appendChild("entry_value", {
                          value: mapEntryValue,
                          render: renderValue,
                          separatorMarker: ",",
                          group: "entry_value",
                          subgroup: "map_entry_value",
                          isStandaloneDiff: true,
                        });
                      }
                      objectTagCounterMap.clear();
                    },
                  },
                );
                break internal_entries;
              }
              if (node.isSet) {
                const setEntriesNode = compositePartsNode.appendChild(
                  "internal_entries",
                  {
                    ...internalEntriesParams,
                    subgroup: "set_entries",
                    childGenerator: () => {
                      let index = 0;
                      for (const [setValue] of value) {
                        setEntriesNode.appendChild(index, {
                          value: setValue,
                          render: renderValue,
                          separatorMarker: ",",
                          group: "entry_value",
                          subgroup: "set_entry",
                          path: setEntriesNode.path.append(index, {
                            isIndexedEntry: true,
                          }),
                          isStandaloneDiff: true,
                        });
                        index++;
                      }
                    },
                  },
                );
                break internal_entries;
              }
              if (node.isURLSearchParams) {
                const searchParamsMap = new Map();
                for (let [urlSearchParamKey, urlSearchParamValue] of value) {
                  const existingUrlSearchParamValue =
                    searchParamsMap.get(urlSearchParamKey);
                  if (existingUrlSearchParamValue) {
                    urlSearchParamValue = [
                      ...existingUrlSearchParamValue,
                      urlSearchParamValue,
                    ];
                  } else {
                    urlSearchParamValue = [urlSearchParamValue];
                  }
                  searchParamsMap.set(urlSearchParamKey, urlSearchParamValue);
                }
                const urlSearchParamEntries = compositePartsNode.appendChild(
                  "internal_entries",
                  {
                    ...internalEntriesParams,
                    subgroup: "url_search_params_entries",
                    childGenerator: () => {
                      for (const [key, values] of searchParamsMap) {
                        const urlSearchParamEntryNode =
                          urlSearchParamEntries.appendChild(key, {
                            key,
                            render: renderChildren,
                            onelineDiff: { hasTrailingSeparator: true },
                            group: "entry",
                            subgroup: "url_search_param_entry",
                            path: node.path.append(key),
                          });
                        urlSearchParamEntryNode.appendChild("entry_key", {
                          value: key,
                          render: renderValue,
                          separatorMarker: " => ",
                          group: "entry_key",
                          subgroup: "url_search_param_entry_key",
                        });
                        urlSearchParamEntryNode.appendChild("entry_value", {
                          value: values,
                          render: renderValue,
                          separatorMarker: ",",
                          group: "entry_value",
                          subgroup: "url_search_param_entry_value",
                          isStandaloneDiff: true,
                        });
                      }
                    },
                  },
                );

                break internal_entries;
              }
              if (node.isHeaders) {
                const headerEntriesNode = compositePartsNode.appendChild(
                  "header_entries",
                  {
                    ...internalEntriesParams,
                    subgroup: "header_entries",
                    childGenerator: () => {
                      for (const [headerName, headerValueRaw] of value) {
                        const headerNode = headerEntriesNode.appendChild(key, {
                          key: headerName,
                          render: renderChildren,
                          onelineDiff: { hasTrailingSeparator: true },
                          group: "entry",
                          subgroup: "header_entry",
                          path: node.path.append(headerName),
                        });
                        headerNode.appendChild("entry_key", {
                          value: headerName,
                          render: renderString,
                          separatorMarker: " => ",
                          group: "entry_key",
                          subgroup: "header_entry_key",
                        });
                        const quoteMarkerRef = {
                          current: pickBestQuote(headerValueRaw),
                        };
                        if (
                          [
                            "access-control-max-age",
                            "age",
                            "content-length",
                          ].includes(headerName)
                        ) {
                          headerNode.appendChild("entry_value", {
                            group: "entry_value",
                            subgroup: "header_entry_value",
                            value: isNaN(headerValueRaw)
                              ? headerValueRaw
                              : parseInt(headerValueRaw),
                            render: renderValue,
                            startMarker: `"`,
                            endMarker: '"',
                            numericSeparatorsDisabled: true,
                          });
                          return;
                        }
                        let attributeHandlers = null;
                        if (headerName === "set-cookie") {
                          attributeHandlers = {};
                        } else if (
                          headerName === "accept" ||
                          headerName === "accept-encoding" ||
                          headerName === "accept-language"
                        ) {
                          attributeHandlers = {
                            q: (attributeValue) => {
                              return isNaN(attributeValue)
                                ? attributeValue
                                : parseFloat(attributeValue);
                            },
                          };
                        } else if (headerName === "server-timing") {
                          attributeHandlers = {
                            dur: (attributeValue) => {
                              return isNaN(attributeValue)
                                ? attributeValue
                                : parseFloat(attributeValue);
                            },
                          };
                        }
                        if (attributeHandlers) {
                          const headerValueNode = headerNode.appendChild(
                            "entry_value",
                            {
                              category: "header_value_parts",
                              group: "entries",
                              subgroup: "header_value",
                              value: headerValueRaw,
                              render: renderChildren,
                              onelineDiff: {
                                skippedMarkers: {
                                  start: "…",
                                  between: "…",
                                  end: "…",
                                },
                              },
                              startMarker: quoteMarkerRef.current,
                              endMarker: quoteMarkerRef.current,
                              childGenerator: () => {
                                generateHeaderValueParts(headerValueRaw, {
                                  headerValueNode,
                                  quoteMarkerRef,
                                });
                              },
                            },
                          );
                          return;
                        }
                        const headerValueArray = headerValueRaw.split(",");
                        const headerValueNode = headerNode.appendChild(
                          "entry_value",
                          {
                            value: headerValueArray,
                            render: renderChildren,
                            onelineDiff: {
                              skippedMarkers: {
                                start: "…",
                                between: "…",
                                end: "…",
                              },
                            },
                            startMarker: quoteMarkerRef.current,
                            endMarker: quoteMarkerRef.current,
                            separatorMarker: ",",
                            childGenerator: () => {
                              let index = 0;
                              for (const headerValue of headerValueArray) {
                                headerValueNode.appendChild(index, {
                                  value: headerValue,
                                  render: renderString,
                                  stringDiffPrecision: "none",
                                  quoteMarkerRef,
                                  quotesDisabled: true,
                                  preserveLineBreaks: true,
                                  separatorMarker: ",",
                                  group: "part",
                                  subgroup: "header_value_part",
                                });
                                index++;
                              }
                            },
                            group: "entries",
                            subgroup: "header_value_entries",
                          },
                        );
                      }
                    },
                  },
                );
                break internal_entries;
              }
            }
            indexed_entries: {
              if (node.isArray) {
                ownPropertyNameToIgnoreSet.add("length");
                const arrayEntriesNode = compositePartsNode.appendChild(
                  "indexed_entries",
                  {
                    render: renderChildrenMultilineWhenDiff,
                    startMarker: "[",
                    endMarker: "]",
                    onelineDiff: {
                      hasMarkersWhenEmpty: true,
                      hasSpacingBetweenEachChild: true,
                      skippedMarkers: {
                        start: "…",
                        between: "…",
                        end: "…",
                      },
                    },
                    multilineDiff: {
                      hasMarkersWhenEmpty: true,
                      hasTrailingSeparator: true,
                      hasNewLineAroundChildren: true,
                      hasIndentBeforeEachChild: true,
                      skippedMarkers: {
                        start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                        between: ["↕ 1 value ↕", "↕ {x} values ↕"],
                        end: ["↓ 1 value ↓", "↓ {x} values ↓"],
                      },
                      maxDiffType: "prop",
                    },
                    group: "entries",
                    subgroup: "array_entries",
                  },
                );
                const arrayChildrenGenerator = () => {
                  let index = 0;
                  while (index < value.length) {
                    ownPropertyNameToIgnoreSet.add(String(index));
                    const hasOwnIndex = Object.hasOwn(value, index);
                    arrayEntriesNode.appendChild(index, {
                      value: hasOwnIndex ? value[index] : ARRAY_EMPTY_VALUE,
                      render: hasOwnIndex ? renderValue : renderEmptyValue,
                      separatorMarker: ",",
                      group: "entry_value",
                      subgroup: "array_entry_value",
                      path: arrayEntriesNode.path.append(index, {
                        isIndexedEntry: true,
                      }),
                      isStandaloneDiff: true,
                    });
                    index++;
                  }
                };
                arrayChildrenGenerator();
                break indexed_entries;
              }
              if (node.isTypedArray) {
                ownPropertyNameToIgnoreSet.add("length");
                const typedEntriesNode = compositePartsNode.appendChild(
                  "indexed_entries",
                  {
                    render: renderChildrenMultilineWhenDiff,
                    startMarker: "[",
                    endMarker: "]",
                    onelineDiff: {
                      hasMarkersWhenEmpty: true,
                      hasSpacingBetweenEachChild: true,
                      skippedMarkers: {
                        start: "…",
                        between: "…",
                        end: "…",
                      },
                    },
                    multilineDiff: {
                      hasMarkersWhenEmpty: true,
                      hasTrailingSeparator: true,
                      hasNewLineAroundChildren: true,
                      hasIndentBeforeEachChild: true,
                      skippedMarkers: {
                        start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                        between: ["↕ 1 value ↕", "↕ {x} values ↕"],
                        end: ["↓ 1 value ↓", "↓ {x} values ↓"],
                      },
                      maxDiffType: "prop",
                    },
                    group: "entries",
                    subgroup: "typed_array_entries",
                  },
                );
                const typedArrayChildrenGenerator = () => {
                  let index = 0;
                  while (index < value.length) {
                    ownPropertyNameToIgnoreSet.add(String(index));
                    typedEntriesNode.appendChild(index, {
                      value: value[index],
                      render: renderNumber,
                      separatorMarker: ",",
                      group: "entry_value",
                      subgroup: "typed_array_entry_value",
                      path: typedEntriesNode.path.append(index, {
                        isIndexedEntry: true,
                      }),
                      isStandaloneDiff: true,
                    });
                    index++;
                  }
                };
                typedArrayChildrenGenerator();
                break indexed_entries;
              }
              if (node.isStringObject) {
                ownPropertyNameToIgnoreSet.add("length");
                let index = 0;
                while (index < value.length) {
                  ownPropertyNameToIgnoreSet.add(String(index));
                  index++;
                }
                break indexed_entries;
              }
            }
            prototype: {
              if (node.objectTag !== "Object") {
                // - [] means Array.prototype
                // - Map("a" => true) means Map.prototype
                // - User {} means User.prototype (each application will "known" what "User" refers to)
                //   This means if 2 proto got the same name
                //   assert will consider they are equal even if that might not be the case
                //   It's a known limitation that could be addressed later
                //   as it's unlikely to happen or be important
                break prototype;
              }
              if (node.isFunction) {
                // prototype can be infered by construct notation
                // -> no need to display it
                // actual: () => {}
                // expect: function () {}
                break prototype;
              }
              if (node.isFunction && node.functionAnalysis.extendedClassName) {
                // prototype property can be infered thanks to the usage of extends
                break prototype;
              }
              const protoValue = Object.getPrototypeOf(value);
              if (protoValue === undefined) {
                break prototype;
              }
              if (protoValue === Object.prototype) {
                // - {} means Object.prototype
                break prototype;
              }
              propertyLikeCallbackSet.add((appendPropertyEntryNode) => {
                appendPropertyEntryNode("__proto__", protoValue);
              });
            }
            own_properties: {
              const allOwnPropertySymbols = Object.getOwnPropertySymbols(value);
              const allOwnPropertyNames = Object.getOwnPropertyNames(value);
              const ownPropertySymbols = [];
              const ownPropertyNames = [];
              for (const ownPropertySymbol of allOwnPropertySymbols) {
                if (ownPropertSymbolToIgnoreSet.has(ownPropertySymbol)) {
                  continue;
                }
                if (shouldIgnoreOwnPropertySymbol(node, ownPropertySymbol)) {
                  continue;
                }
                ownPropertySymbols.push(ownPropertySymbol);
              }
              for (const ownPropertyName of allOwnPropertyNames) {
                if (ownPropertyNameToIgnoreSet.has(ownPropertyName)) {
                  continue;
                }
                if (shouldIgnoreOwnPropertyName(node, ownPropertyName)) {
                  continue;
                }
                ownPropertyNames.push(ownPropertyName);
              }
              if (node.isAbortSignal) {
                const aborted = value.aborted;
                if (aborted) {
                  propertyLikeCallbackSet.add((appendPropertyEntryNode) => {
                    appendPropertyEntryNode("aborted", true);
                  });
                  const reason = value.reason;
                  if (reason !== undefined) {
                    propertyLikeCallbackSet.add((appendPropertyEntryNode) => {
                      appendPropertyEntryNode("reason", reason);
                    });
                  }
                }
              }
              // the idea here is that when an object does not have any property
              // we skip entirely the creation of own_properties node so that
              // if that value is compared to an object
              // {} is not even displayed even if empty
              // as a result an array without own property would be displayed as follow:
              // "[]"
              // and not
              // "[] {}"
              // the goal is to enable this for every well known object tag
              // one of the easiest way to achieve this would be to added something like
              // hasWellKnownPrototype: boolean
              // -> to be added when comparing prototypes
              const canSkipOwnProperties =
                node.isArray ||
                node.isTypedArray ||
                node.isMap ||
                node.isSet ||
                node.isURL ||
                node.isURLSearchParams ||
                node.isRequest ||
                node.isResponse ||
                node.isAbortController ||
                node.isAbortSignal ||
                node.isError ||
                node.isRegExp;
              const skipOwnProperties =
                canSkipOwnProperties &&
                ownPropertySymbols.length === 0 &&
                ownPropertyNames.length === 0 &&
                propertyLikeCallbackSet.size === 0;
              if (skipOwnProperties) {
                break own_properties;
              }
              const hasMarkersWhenEmpty =
                !objectConstructNode && !canSkipOwnProperties;
              const ownPropertiesNode = compositePartsNode.appendChild(
                "own_properties",
                {
                  render: renderChildrenMultilineWhenDiff,
                  group: "entries",
                  subgroup: "own_properties",
                  ...(node.isClassPrototype
                    ? {
                        onelineDiff: {
                          hasMarkersWhenEmpty,
                          separatorBetweenEachChildDisabled: true,
                        },
                        multilineDiff: {
                          hasMarkersWhenEmpty,
                          separatorBetweenEachChildDisabled: true,
                        },
                      }
                    : {
                        startMarker: "{",
                        endMarker: "}",
                        onelineDiff: {
                          hasMarkersWhenEmpty,
                          hasSpacingAroundChildren: true,
                          hasSpacingBetweenEachChild: true,
                        },
                        multilineDiff: {
                          hasMarkersWhenEmpty,
                          hasTrailingSeparator: true,
                          hasNewLineAroundChildren: true,
                          hasIndentBeforeEachChild: true,
                          skippedMarkers: {
                            start: ["↑ 1 prop ↑", "↑ {x} props ↑"],
                            between: ["↕ 1 prop ↕", "↕ {x} props ↕"],
                            end: ["↓ 1 prop ↓", "↓ {x} props ↓"],
                          },
                          maxDiffType: "prop",
                        },
                      }),
                  childGenerator: () => {
                    const appendPropertyNode = (
                      propertyKey,
                      propertyDescriptor,
                      {
                        isSourceCode,
                        isFunctionPrototype,
                        isClassPrototype,
                        isHiddenWhenSame,
                        isHiddenWhenSolo,
                        isBody,
                      },
                    ) => {
                      const propertyConverter =
                        propertyConverterMap.get(propertyKey);
                      if (propertyConverter) {
                        const converterResult = propertyConverter();
                        propertyKey = converterResult[0];
                        propertyDescriptor = { value: converterResult[1] };
                      }
                      const ownPropertyNode = ownPropertiesNode.appendChild(
                        propertyKey,
                        {
                          key: propertyKey,
                          render: renderChildrenMultilineWhenDiff,
                          multilineDiff: {
                            hasIndentBetweenEachChild: true,
                          },
                          onelineDiff: {
                            hasTrailingSeparator: true,
                            hasSpacingBetweenEachChild: true,
                          },
                          focusedChildIndex: 0,
                          isFunctionPrototype,
                          isClassPrototype,
                          isHiddenWhenSame,
                          isHiddenWhenSolo,
                          childGenerator: () => {
                            let isMethod = false;
                            if (propertyDescriptor.value) {
                              isMethod =
                                typeof propertyDescriptor.value ===
                                  "function" &&
                                tokenizeFunction(propertyDescriptor.value)
                                  .type === "method";
                            }
                            for (const descriptorName of Object.keys(
                              propertyDescriptor,
                            )) {
                              const descriptorValue =
                                propertyDescriptor[descriptorName];
                              if (
                                shouldIgnoreOwnPropertyDescriptor(
                                  node,
                                  descriptorName,
                                  descriptorValue,
                                  {
                                    isFrozen,
                                    isSealed,
                                    propertyKey,
                                  },
                                )
                              ) {
                                continue;
                              }
                              const descriptorNode =
                                ownPropertyNode.appendChild(descriptorName, {
                                  render: renderChildren,
                                  onelineDiff: {
                                    hasTrailingSeparator: true,
                                  },
                                  focusedChildIndex: 0,
                                  group: "entries",
                                  subgroup: "property_descriptor",
                                  isHiddenWhenSame:
                                    descriptorName === "configurable" ||
                                    descriptorName === "writable" ||
                                    descriptorName === "enumerable",
                                });
                              if (
                                descriptorName === "configurable" ||
                                descriptorName === "writable" ||
                                descriptorName === "enumerable"
                              ) {
                                descriptorNode.appendChild("descriptor_name", {
                                  ...getGrammarProps(),
                                  group: "property_descriptor_name",
                                  value: descriptorName,
                                  separatorMarker: " ",
                                });
                              }
                              if (
                                node.functionAnalysis.type === "class" &&
                                !isClassPrototype
                              ) {
                                descriptorNode.appendChild("static_keyword", {
                                  ...getGrammarProps(),
                                  group: "static_keyword",
                                  value: "static",
                                  separatorMarker: " ",
                                  isHidden: isSourceCode || isMethod,
                                });
                              }
                              if (
                                descriptorName !== "get" &&
                                descriptorName !== "set"
                              ) {
                                descriptorNode.appendChild("entry_key", {
                                  value: propertyKey,
                                  render: renderPrimitive,
                                  quotesDisabled:
                                    typeof propertyKey === "string" &&
                                    isValidPropertyIdentifier(propertyKey),
                                  quotesBacktickDisabled: true,
                                  separatorMarker: node.isClassPrototype
                                    ? ""
                                    : node.functionAnalysis.type === "class"
                                      ? " = "
                                      : ": ",
                                  separatorMarkerWhenTruncated:
                                    node.isClassPrototype
                                      ? ""
                                      : node.functionAnalysis.type === "class"
                                        ? ";"
                                        : ",",
                                  group: "entry_key",
                                  subgroup: "property_key",
                                  isHidden:
                                    isSourceCode ||
                                    isMethod ||
                                    isClassPrototype,
                                });
                              }
                              descriptorNode.appendChild("entry_value", {
                                key: descriptorName,
                                value: descriptorValue,
                                render: renderValue,
                                separatorMarker:
                                  node.functionAnalysis.type === "class"
                                    ? ";"
                                    : ",",
                                group: "entry_value",
                                subgroup: "property_descriptor_value",
                                isSourceCode,
                                isBody,
                                isFunctionPrototype,
                                isClassPrototype,
                                isStandaloneDiff: true,
                              });
                            }
                          },
                          group: "entry",
                          subgroup: "property_entry",
                          path: node.path.append(propertyKey),
                        },
                      );
                      return ownPropertyNode;
                    };
                    const appendPropertyNodeSimplified = (
                      propertyKey,
                      propertyValue,
                      params = {},
                    ) => {
                      return appendPropertyNode(
                        propertyKey,
                        {
                          // enumerable: true,
                          // /* eslint-disable no-unneeded-ternary */
                          // configurable: isFrozen || isSealed ? false : true,
                          // writable: isFrozen ? false : true,
                          // /* eslint-enable no-unneeded-ternary */
                          value: propertyValue,
                        },
                        params,
                      );
                    };

                    if (node.isFunction) {
                      appendPropertyNodeSimplified(
                        SOURCE_CODE_ENTRY_KEY,
                        node.functionAnalysis.argsAndBodySource,
                        {
                          isSourceCode: true,
                        },
                      );
                    }
                    for (const propertyLikeCallback of propertyLikeCallbackSet) {
                      propertyLikeCallback(appendPropertyNodeSimplified);
                    }
                    for (const ownPropertySymbol of ownPropertySymbols) {
                      const ownPropertySymbolDescriptor =
                        Object.getOwnPropertyDescriptor(
                          value,
                          ownPropertySymbol,
                        );
                      appendPropertyNode(
                        ownPropertySymbol,
                        ownPropertySymbolDescriptor,
                        {
                          isHiddenWhenSame: true,
                        },
                      );
                    }
                    for (let ownPropertyName of ownPropertyNames) {
                      const ownPropertyNameDescriptor =
                        Object.getOwnPropertyDescriptor(value, ownPropertyName);
                      appendPropertyNode(
                        ownPropertyName,
                        ownPropertyNameDescriptor,
                        {
                          isFunctionPrototype:
                            ownPropertyName === "prototype" && node.isFunction,
                          isClassPrototype:
                            ownPropertyName === "prototype" &&
                            node.functionAnalysis.type === "class",
                          isHiddenWhenSame:
                            (ownPropertyName === "lastIndex" &&
                              node.isRegExp) ||
                            (ownPropertyName === "headers" &&
                              node.subgroup === "arg_entry_value"),
                          isHiddenWhenSolo:
                            ownPropertyName === "lastIndex" && node.isRegExp,
                        },
                      );
                    }
                  },
                },
              );
            }
            if (objectIntegrityMethodName) {
              compositePartsNode.appendChild(
                "object_integrity_call_close_parenthesis",
                {
                  ...getGrammarProps(),
                  group: "grammar",
                  value: ")",
                  hasLeftSpacingDisabled: true,
                },
              );
            }
          },
          group: "entries",
          subgroup: "composite_parts",
        });
      };
      node.wrappedNodeGetter = () => {
        const compositePartsNode = node.childNodeMap.get("parts");
        if (!compositePartsNode) {
          return null;
        }
        const constructNode = compositePartsNode.childNodeMap.get("construct");
        if (constructNode) {
          const constructCallNode = constructNode.childNodeMap.get("call");
          if (constructCallNode) {
            const argEntriesNode = constructCallNode.childNodeMap.get("args");
            const firstArgNode = argEntriesNode.childNodeMap.get(0);
            return firstArgNode;
          }
        }
        const ownPropertiesNode =
          compositePartsNode.childNodeMap.get("own_properties");
        if (ownPropertiesNode) {
          const symbolToPrimitiveReturnValuePropertyNode =
            ownPropertiesNode.childNodeMap.get(
              SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY,
            );
          if (symbolToPrimitiveReturnValuePropertyNode) {
            return getPropertyValueNode(
              symbolToPrimitiveReturnValuePropertyNode,
            );
          }
          const valueOfReturnValuePropertyNode =
            ownPropertiesNode.childNodeMap.get(VALUE_OF_RETURN_VALUE_ENTRY_KEY);
          if (valueOfReturnValuePropertyNode) {
            return getPropertyValueNode(valueOfReturnValuePropertyNode);
          }
        }
        return null;
      };
      return node;
    }
    node.category = "primitive";
    return node;
  };

  const renderOptionsDefault = {};
  const referenceFromOthersSetDefault = new Set();

  const appendChildNodeGeneric = (node, childKey, params) => {
    const childNode = createNode({
      id: node.nextId(),
      context: node.context,
      parent: node,
      path: node.path,
      referenceMap: node.referenceMap,
      nextId: node.nextId,
      depth:
        params.group === "entries" ||
        params.group === "entry" ||
        params.isClassPrototype ||
        node.parent?.isClassPrototype
          ? node.depth
          : node.depth + 1,
      ...params,
    });
    node.childNodeMap.set(childKey, childNode);
    return childNode;
  };
}
// - no quote escaping
// - no line splitting
const getGrammarProps = () => {
  return {
    quotesDisabled: true,
    urlStringDetectionDisabled: false,
    dateStringDetectionDisabled: false,
    stringDiffPrecision: "none",
    render: renderString,
  };
};

const createMethodCallNode = (
  node,
  { objectName, methodName, args, renderOnlyArgs },
) => {
  return {
    render: renderChildren,
    onelineDiff: {
      hasTrailingSeparator: true,
    },
    group: "entries",
    subgroup: "method_call",
    childGenerator: (methodCallNode) => {
      methodCallNode.appendChild("object_name", {
        ...getGrammarProps(),
        group: "object_name",
        value: objectName,
      });
      if (methodName) {
        methodCallNode.appendChild("method_dot", {
          ...getGrammarProps(),
          group: "method_dot",
          value: ".",
        });
        methodCallNode.appendChild("method_name", {
          ...getGrammarProps(),
          group: "method_name",
          value: methodName,
        });
      }

      methodCallNode.appendChild(
        "args",
        createArgEntriesNode(methodCallNode, {
          renderOnlyArgs,
          args,
        }),
      );
    },
  };
};

const createArgEntriesNode = (node, { args, renderOnlyArgs }) => {
  return {
    render: renderChildren,
    startMarker: "(",
    endMarker: ")",
    onelineDiff: {
      hasMarkersWhenEmpty: true,
      hasSpacingBetweenEachChild: true,
    },
    ...(renderOnlyArgs ? {} : {}),
    group: "entries",
    subgroup: "arg_entries",
    childGenerator: (callNode) => {
      const appendArgEntry = (argIndex, argValue, { key, ...valueParams }) => {
        callNode.appendChild(argIndex, {
          group: "entry_value",
          subgroup: "arg_entry_value",
          value: argValue,
          render: renderValue,
          separatorMarker: ",",
          path: node.path.append(key || argIndex),
          depth: node.depth,
          isStandaloneDiff: true,
          ...valueParams,
        });
      };
      let argIndex = 0;
      for (const { value, ...argParams } of args) {
        appendArgEntry(argIndex, value, argParams);
        argIndex++;
      }
    },
  };
};

const DOUBLE_QUOTE = `"`;
const SINGLE_QUOTE = `'`;
const BACKTICK = "`";
const forceSameQuotes = (actualNode, expectNode) => {
  const actualQuoteMarkerRef = actualNode.quoteMarkerRef;
  const expectQuoteMarkerRef = expectNode.quoteMarkerRef;
  const actualQuote = actualQuoteMarkerRef ? actualQuoteMarkerRef.current : "";
  const expectQuote = expectQuoteMarkerRef ? expectQuoteMarkerRef.current : "";
  if (actualQuote === '"' && expectQuote !== '"') {
    actualQuoteMarkerRef.current = expectQuote;
    actualNode.startMarker = actualNode.endMarker = expectQuote;
  } else if (actualQuote !== expectQuote) {
    expectQuoteMarkerRef.current = actualQuote;
    expectNode.startMarker = expectNode.endMarker = actualQuote;
  }
};

const getAddedOrRemovedReason = (node) => {
  if (node.group === "url_part") {
    return node.subgroup;
  }
  if (node.group === "date_part") {
    return node.subgroup;
  }
  if (node.group === "time_part") {
    return node.subgroup;
  }
  if (node.category === "entry") {
    return node.key;
  }
  if (node.category === "entry_key") {
    return node.value;
  }
  if (node.category === "entry_value") {
    return getAddedOrRemovedReason(node.parent);
  }
  return "unknown";
};

const getWrappedNode = (node, predicate) => {
  const wrappedNode = node.wrappedNodeGetter();
  if (!wrappedNode) {
    return null;
  }
  if (predicate(wrappedNode)) {
    return wrappedNode;
  }
  // can happen for
  // valueOf: () => {
  //   return { valueOf: () => 10 }
  // }
  const nested = getWrappedNode(wrappedNode, predicate);
  if (nested) {
    return nested;
  }
  return null;
};
// const asCompositeNode = (node) =>
//   getWrappedNode(
//     node,
//     (wrappedNodeCandidate) => wrappedNodeCandidate.group === "composite",
//   );
const asPrimitiveNode = (node) =>
  getWrappedNode(
    node,
    (wrappedNodeCandidate) => wrappedNodeCandidate.category === "primitive",
  );

const shouldIgnoreOwnPropertyName = (node, ownPropertyName) => {
  if (ownPropertyName === "prototype") {
    // ignore prototype if it's the default prototype
    // created by the runtime
    const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(
      node.value,
      ownPropertyName,
    );
    if (!Object.hasOwn(ownPropertyDescriptor, "value")) {
      return false;
    }
    const prototypeValue = ownPropertyDescriptor.value;
    if (node.isArrowFunction) {
      return prototypeValue === undefined;
    }
    if (node.isAsyncFunction && !node.isGeneratorFunction) {
      return prototypeValue === undefined;
    }
    if (!isComposite(prototypeValue)) {
      return false;
    }
    const constructorDescriptor = Object.getOwnPropertyDescriptor(
      prototypeValue,
      "constructor",
    );
    if (!constructorDescriptor) {
      return false;
    }
    // the default prototype.constructor is
    // configurable, writable, non enumerable and got a value
    if (
      !constructorDescriptor.configurable ||
      !constructorDescriptor.writable ||
      constructorDescriptor.enumerable ||
      constructorDescriptor.set ||
      constructorDescriptor.get
    ) {
      return false;
    }
    const constructorValue = constructorDescriptor.value;
    if (constructorValue !== node.value) {
      return false;
    }
    const propertyNames = Object.getOwnPropertyNames(prototypeValue);
    return propertyNames.length === 1;
  }
  if (ownPropertyName === "constructor") {
    // if (
    //   node.parent.key === "prototype" &&
    //   node.parent.parent.isFunction &&
    //   Object.hasOwn(ownPropertyDescriptor, "value") &&
    //   ownPropertyDescriptor.value === node.parent.parent.value
    // ) {
    return true;
    //  }
    //  break ignore;
  }
  return false;
};
const shouldIgnoreOwnPropertySymbol = (node, ownPropertySymbol) => {
  if (ownPropertySymbol === Symbol.toStringTag) {
    const propertySymbolDescriptor = Object.getOwnPropertyDescriptor(
      node.value,
      Symbol.toStringTag,
    );
    if (Object.hasOwn(propertySymbolDescriptor, "value")) {
      // toStringTag is already reflected on subtype
      return true;
    }
    return false;
  }

  const keyForSymbol = Symbol.keyFor(ownPropertySymbol);
  const symbolDescription = symbolToDescription(ownPropertySymbol);
  if (node.isPromise) {
    if (keyForSymbol) {
      return false;
    }
    if (symbolDescription === "async_id_symbol") {
      // nodejs runtime puts a custom Symbol on promise
      return true;
    }
    return false;
  }
  if (node.isHeaders) {
    if (keyForSymbol) {
      return false;
    }
    // nodejs runtime put custom symbols on Headers
    if (["guard", "headers list", "realm"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.isAbortSignal) {
    if (keyForSymbol) {
      return false;
    }
    if (
      [
        "realm",
        "kAborted",
        "kReason",
        "kEvents",
        "events.maxEventTargetListeners",
        "events.maxEventTargetListenersWarned",
        "kHandlers",
        "kComposite",
      ].includes(symbolDescription)
    ) {
      return true;
    }
  }
  if (node.isRequest) {
    if (Symbol.keyFor(ownPropertySymbol)) {
      return false;
    }
    // nodejs runtime put custom symbols on Request
    if (
      ["state", "signal", "abortController", "headers"].includes(
        symbolDescription,
      )
    ) {
      return true;
    }
  }
  if (node.isResponse) {
    if (Symbol.keyFor(ownPropertySymbol)) {
      return false;
    }
    if (["state", "headers"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.objectTag === "ReadableStream") {
    const keyForSymbol = Symbol.keyFor(ownPropertySymbol);
    if (keyForSymbol && keyForSymbol.startsWith("nodejs.webstream.")) {
      return true;
    }
    if (["kType", "kState"].includes(symbolDescription)) {
      return true;
    }
  }
  return false;
};
const shouldIgnoreOwnPropertyDescriptor = (
  node,
  descriptorName,
  descriptorValue,
  { isFrozen, isSealed, propertyKey },
) => {
  if (descriptorName === "writable") {
    if (isFrozen) {
      return true;
    }
    if (propertyKey === "prototype" && node.functionAnalysis.type === "class") {
      return descriptorValue === false;
    }
    return descriptorValue === true;
  }
  if (descriptorName === "configurable") {
    if (isFrozen) {
      return true;
    }
    if (isSealed) {
      return true;
    }
    if (propertyKey === "prototype" && node.isFunction) {
      return descriptorValue === false;
    }
    return descriptorValue === true;
  }
  if (descriptorName === "enumerable") {
    if (propertyKey === "prototype" && node.isFunction) {
      return descriptorValue === false;
    }
    if (propertyKey === "message" && node.isError) {
      return descriptorValue === false;
    }
    if (node.isClassPrototype) {
      return descriptorValue === false;
    }
    return descriptorValue === true;
  }
  if (descriptorName === "get") {
    return descriptorValue === undefined;
  }
  if (descriptorName === "set") {
    return descriptorValue === undefined;
  }
  return false;
};
// const shouldIgnorePropertyDescriptor = (
//   node,
//   propertyKey,
//   descriptorKey,
//   descriptorValue,
// ) => {
//   /* eslint-disable no-unneeded-ternary */
//   if (descriptorKey === "writable") {
//     if (node.propsFrozen) {
//       return true;
//     }
//     const writableDefaultValue =
//       propertyKey === "prototype" && node.isClass ? false : true;
//     return descriptorValue === writableDefaultValue;
//   }
//   if (descriptorKey === "configurable") {
//     if (node.propsFrozen) {
//       return true;
//     }
//     if (node.propsSealed) {
//       return true;
//     }
//     const configurableDefaultValue =
//       propertyKey === "prototype" && node.isFunction ? false : true;
//     return descriptorValue === configurableDefaultValue;
//   }
//   if (descriptorKey === "enumerable") {
//     const enumerableDefaultValue =
//       (propertyKey === "prototype" && node.isFunction) ||
//       (propertyKey === "message" && node.isError) ||
//       node.isClassPrototype
//         ? false
//         : true;
//     return descriptorValue === enumerableDefaultValue;
//   }
//   /* eslint-enable no-unneeded-ternary */
//   if (descriptorKey === "get") {
//     return descriptorValue === undefined;
//   }
//   if (descriptorKey === "set") {
//     return descriptorValue === undefined;
//   }
//   return false;
// };

const createReasons = () => {
  const overall = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set(),
  };
  const self = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set(),
  };
  const inside = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set(),
  };

  return {
    overall,
    self,
    inside,
  };
};
const appendReasons = (reasonSet, ...otherReasonSets) => {
  for (const otherReasonSet of otherReasonSets) {
    for (const reason of otherReasonSet) {
      reasonSet.add(reason);
    }
  }
};
const appendReasonGroup = (reasonGroup, otherReasonGroup) => {
  appendReasons(reasonGroup.any, otherReasonGroup.any);
  appendReasons(reasonGroup.removed, otherReasonGroup.removed);
  appendReasons(reasonGroup.added, otherReasonGroup.added);
  appendReasons(reasonGroup.modified, otherReasonGroup.modified);
};

const canParseUrl = (value) => {
  if (!canParseUrlNative(value)) {
    return false;
  }
  if (value.includes("\n")) {
    return false;
  }
  // without this check something like "a:b" would be a valid url
  const knownProtocols = [
    "ftp:",
    "http:",
    "https:",
    "file:",
    "wss:",
    "blob:",
    "data:",
    "mailto:",
  ];
  const valueLowerCase = value.toLowerCase();
  for (const knownProtocol of knownProtocols) {
    if (valueLowerCase.startsWith(knownProtocol)) {
      return true;
    }
  }
  return false;
};
const canParseUrlNative =
  URL.canParse ||
  ((value) => {
    try {
      // eslint-disable-next-line no-new
      new URL(value);
      return true;
    } catch {
      return false;
    }
  });

const symbolToDescription = (symbol) => {
  const toStringResult = symbol.toString();
  const openingParenthesisIndex = toStringResult.indexOf("(");
  const closingParenthesisIndex = toStringResult.indexOf(")");
  return toStringResult.slice(
    openingParenthesisIndex + 1,
    closingParenthesisIndex,
  );
  // return symbol.description // does not work on node
};

// const regExpSpecialCharSet = new Set([
//   "/",
//   "^",
//   "\\",
//   "[",
//   "]",
//   "(",
//   ")",
//   "{",
//   "}",
//   "?",
//   "+",
//   "*",
//   ".",
//   "|",
//   "$",
// ]);

const pickBestQuote = (string, { quotesBacktickDisabled } = {}) => {
  let backslashCount = 0;
  let doubleQuoteCount = 0;
  let singleQuoteCount = 0;
  let backtickCount = 0;
  for (const char of string) {
    if (char === "\\") {
      backslashCount++;
    } else {
      if (backslashCount % 2 > 0) {
        // it's escaped
      } else if (char === DOUBLE_QUOTE) {
        doubleQuoteCount++;
      } else if (char === SINGLE_QUOTE) {
        singleQuoteCount++;
      } else if (char === BACKTICK) {
        backtickCount++;
      }
      backslashCount = 0;
    }
  }

  if (doubleQuoteCount === 0) {
    return DOUBLE_QUOTE;
  }
  if (singleQuoteCount === 0) {
    return SINGLE_QUOTE;
  }
  if (backtickCount === 0 && !quotesBacktickDisabled) {
    return BACKTICK;
  }
  if (singleQuoteCount > doubleQuoteCount) {
    return DOUBLE_QUOTE;
  }
  if (doubleQuoteCount > singleQuoteCount) {
    return SINGLE_QUOTE;
  }
  return DOUBLE_QUOTE;
};

const generateHeaderValueParts = (
  headerValue,
  { headerValueNode, quoteMarkerRef },
) => {
  let partIndex = 0;
  let partRaw;
  let part;
  let attribute;
  let attributeMap = null;
  let attributeNameStarted = false;
  let attributeValueStarted = false;
  let attributeName = "";
  let attributeValue = "";
  const startHeaderValuePart = () => {
    if (part) {
      part.end();
      part = null;
    }
    part = {
      end: () => {
        if (!attributeMap) {
          return;
        }
        if (attribute) {
          attribute.end();
          attribute = null;
        }
        if (attributeMap.size === 0) {
          attributeMap = null;
          part = null;
          return;
        }
        const headerValuePartNode = headerValueNode.appendChild(partIndex, {
          group: "entries",
          subgroup: "header_part",
          value: partRaw,
          render: renderChildren,
          onelineDiff: {},
          startMarker: partIndex === 0 ? "" : ",",
          path: headerValueNode.path.append(partIndex, {
            isIndexedEntry: true,
          }),
        });
        let isFirstAttribute = true;
        for (const [attributeName, attributeValue] of attributeMap) {
          const attributeNameNormalized = attributeName.trim();
          const headerAttributeNode = headerValuePartNode.appendChild(
            attributeNameNormalized,
            {
              group: "entry",
              subgroup: "header_attribute",
              render: renderChildren,
              onelineDiff: {},
              path: headerValuePartNode.path.append(attributeNameNormalized),
            },
          );
          if (attributeValue === true) {
            headerAttributeNode.appendChild("entry_key", {
              subgroup: "header_attribute_name",
              value: attributeName,
              render: renderString,
              stringDiffPrecision: "none",
              quotesDisabled: true,
              quoteMarkerRef,
              startMarker: isFirstAttribute ? "" : ";",
            });
          } else {
            headerAttributeNode.appendChild("entry_key", {
              subgroup: "header_attribute_name",
              value: attributeName,
              render: renderString,
              stringDiffPrecision: "none",
              quotesDisabled: true,
              quoteMarkerRef,
              startMarker: isFirstAttribute ? "" : ";",
              endMarker: "=",
            });
            headerAttributeNode.appendChild("entry_value", {
              subgroup: "header_attribute_value",
              key: attributeName,
              value: attributeValue,
              render: renderString,
              stringDiffPrecision: "none",
              quotesDisabled: true,
              quoteMarkerRef,
            });
          }
          isFirstAttribute = false;
        }
        partIndex++;
        attributeMap = null;
        part = null;
      },
    };
    partRaw = "";
    attributeMap = new Map();
    startAttributeName();
  };
  const startAttributeName = () => {
    if (attribute) {
      attribute.end();
      attribute = null;
    }
    attributeNameStarted = true;
    attribute = {
      end: () => {
        if (!attributeNameStarted && !attributeValueStarted) {
          return;
        }
        if (!attributeValue) {
          if (!attributeName) {
            // trailing ";" (or trailing ",")
            attributeNameStarted = false;
            return;
          }
          attributeMap.set(attributeName, true);
          attributeNameStarted = false;
          attributeName = "";
          attributeValueStarted = false;
          return;
        }
        attributeMap.set(attributeName, attributeValue);
        attributeNameStarted = false;
        attributeName = "";
        attributeValueStarted = false;
        attributeValue = "";
      },
    };
  };
  const startAttributeValue = () => {
    attributeNameStarted = false;
    attributeValueStarted = true;
  };
  startHeaderValuePart();
  let charIndex = 0;
  while (charIndex < headerValue.length) {
    const char = headerValue[charIndex];
    partRaw += char;
    if (char === ",") {
      startHeaderValuePart();
      charIndex++;
      continue;
    }
    if (char === ";") {
      startAttributeName();
      charIndex++;
      continue;
    }
    if (char === "=") {
      startAttributeValue();
      charIndex++;
      continue;
    }
    if (attributeValueStarted) {
      attributeValue += char;
      charIndex++;
      continue;
    }
    if (attributeNameStarted) {
      attributeName += char;
      charIndex++;
      continue;
    }
    throw new Error("wtf");
  }
  part.end();
};
