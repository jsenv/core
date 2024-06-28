/*
 * LE PLUS DUR QU'IL FAUT FAIRE AVANT TOUT:
 *
 * - quotes
 *    - quote in property name
 *    - ensure backtick cannot be used for object property key
 *    - quote in url search param name
 *    - quote in url search param value
 *    - quote in url pathname
 *  - regexp
 *  - object integrity
 *  - url search params
 *  - weakset/weakmap/promise
 *  - more wrapped value tests (from internal_value.xtest.js)
 *  - prototype
 *  - property descriptors
 *  - date
 *  - headers
 *  - request/response
 */

import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";

import { isComposite } from "./is_composite.js";
import { isValidPropertyIdentifier } from "./property_identifier.js";
import { createValuePath } from "./value_path.js";
import { getObjectTag, objectPrototypeChainGenerator } from "./object_tag.js";
import {
  tokenizeFunction,
  defaultFunctionAnalysis,
} from "./tokenize_function.js";
import { tokenizeFloat, tokenizeInteger } from "./tokenize_number.js";
import { tokenizeString } from "./tokenize_string.js";
import { tokenizeUrlSearch } from "./tokenize_url_search.js";
import { getWellKnownValuePath } from "./well_known_value.js";
import { getIsNegativeZero } from "./utils/negative_zero.js";
import { groupDigits } from "./utils/group_digits.js";

// ANSI.supported = false;
const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectColor = ANSI.RED;
const expectColor = ANSI.GREEN;
/**
 * When a js value CANNOT EXISTS in actual or expected
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
};
/**
 * When a js value DOES NOT EXISTS ANYMORE in actual or expected
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
};
const PLACEHOLDER_FOR_SAME = {
  placeholder: "same",
};
const PLACEHOLDER_FOR_MODIFIED = {
  placeholder: "modified",
};
const ARRAY_EMPTY_VALUE = { tag: "array_empty_value" };
const SOURCE_CODE_ENTRY_KEY = { key: "[[source code]]" };
const VALUE_OF_RETURN_VALUE_ENTRY_KEY = { key: "valueOf()" };
const SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY = {
  key: "Symbol.toPrimitive()",
};

const setColor = (text, color) => {
  if (text.trim() === "") {
    // cannot set color of blank chars
    return text;
  }
  const textColored = ANSI.color(text, color);
  // if (color === ANSI.RED || color === ANSI.GREEN) {
  //   return ANSI.effect(textColored, ANSI.UNDERLINE);
  // }
  return textColored;
};

const defaultOptions = {
  actual: undefined,
  expect: undefined,
  MAX_DEPTH: 5,
  MAX_DEPTH_INSIDE_DIFF: 1,
  MAX_DIFF_INSIDE_VALUE: { prop: 2, line: 1 },
  MAX_CONTEXT_BEFORE_DIFF: { prop: 2, line: 3 },
  MAX_CONTEXT_AFTER_DIFF: { prop: 2, line: 3 },
  MAX_COLUMNS: 100,
};

export const assert = (firstArg) => {
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
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF,
    MAX_COLUMNS,
  } = {
    ...defaultOptions,
    ...firstArg,
  };

  const actualRootNode = createRootNode({
    colorWhenSolo: addedColor,
    colorWhenSame: sameColor,
    colorWhenModified: unexpectColor,
    name: "actual",
    origin: "actual",
    value: actual,
    // otherValue: expect,
    render: renderValue,
  });
  const expectRootNode = createRootNode({
    colorWhenSolo: removedColor,
    colorWhenSame: sameColor,
    colorWhenModified: expectColor,
    name: "expect",
    origin: "expect",
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
  const compare = (actualNode, expectNode) => {
    if (actualNode.ignore && actualNode.comparison) {
      return actualNode.comparison;
    }
    if (expectNode.ignore && expectNode.comparison) {
      return expectNode.comparison;
    }
    const reasons = createReasons();
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

    const onSelfDiff = (reason) => {
      reasons.self.modified.add(reason);
      causeSet.add(comparison);
    };
    const onAdded = (reason) => {
      reasons.self.added.add(reason);
      causeSet.add(comparison);
    };
    const onRemoved = (reason) => {
      reasons.self.removed.add(reason);
      causeSet.add(comparison);
    };

    const subcompareDuo = (
      actualChildNode,
      expectChildNode,
      { revertNot } = {},
    ) => {
      let isNotPrevious = isNot;
      if (revertNot) {
        isNot = !isNot;
      }
      const childComparison = compare(actualChildNode, expectChildNode);
      isNot = isNotPrevious;
      appendReasonGroup(
        comparison.reasons.inside,
        childComparison.reasons.overall,
      );
      return childComparison;
    };
    const subcompareSolo = (childNode, placeholderNode, compareOptions) => {
      if (childNode.name === "actual") {
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
      actual_children_comparisons: {
        const actualChildrenKeys = [];
        let actualFirstChildWithDiffKey;
        for (let [childKey, actualChildNode] of actualNode.childNodeMap) {
          let expectChildNode;
          if (isSetEntriesComparison) {
            const actualSetValueNode = actualChildNode;
            for (const [, expectSetValueNode] of expectNode.childNodeMap) {
              if (expectSetValueNode.value === actualSetValueNode.value) {
                expectChildNode = expectSetValueNode;
                break;
              }
            }
          } else {
            expectChildNode = expectNode.childNodeMap.get(childKey);
          }
          if (actualChildNode && expectChildNode) {
            const childComparison = subcompareDuo(
              actualChildNode,
              expectChildNode,
            );
            childComparisonMap.set(childKey, childComparison);
            if (childComparison.hasAnyDiff) {
              childComparisonDiffMap.set(childKey, childComparison);
            }
            if (!actualChildNode.isHidden) {
              actualChildrenKeys.push(childKey);
              if (
                childComparison.hasAnyDiff &&
                actualFirstChildWithDiffKey === undefined
              ) {
                actualFirstChildWithDiffKey = childKey;
              }
            }
            continue;
          }
          const addedChildComparison = subcompareSolo(
            actualChildNode,
            PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
          );
          childComparisonMap.set(childKey, addedChildComparison);
          childComparisonDiffMap.set(childKey, addedChildComparison);
          if (!actualChildNode.isHidden) {
            actualChildrenKeys.push(childKey);
            if (actualFirstChildWithDiffKey === undefined) {
              actualFirstChildWithDiffKey = childKey;
            }
          }
        }
        actualNode.childrenKeys = actualChildrenKeys;
        actualNode.firstChildWithDiffKey = actualFirstChildWithDiffKey;
      }
      expect_children_comparisons: {
        const expectChildrenKeys = [];
        let expectFirstChildWithDiffKey;
        for (let [childKey, expectChildNode] of expectNode.childNodeMap) {
          if (isSetEntriesComparison) {
            const expectSetValueNode = expectChildNode;
            let hasEntry;
            for (const [, actualSetValueNode] of actualNode.childNodeMap) {
              if (actualSetValueNode.value === expectSetValueNode.value) {
                hasEntry = true;
                break;
              }
            }
            if (hasEntry) {
              if (!expectChildNode.isHidden) {
                expectChildrenKeys.push(childKey);
              }
              continue;
            }
          } else {
            const childComparison = childComparisonMap.get(childKey);
            if (childComparison) {
              if (!expectChildNode.isHidden) {
                expectChildrenKeys.push(childKey);
                if (
                  childComparison.hasAnyDiff &&
                  expectFirstChildWithDiffKey === undefined
                ) {
                  expectFirstChildWithDiffKey = childKey;
                }
              }
              continue;
            }
          }
          const removedChildComparison = subcompareSolo(
            expectChildNode,
            PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
          );
          childComparisonMap.set(childKey, removedChildComparison);
          childComparisonDiffMap.set(childKey, removedChildComparison);
          if (!expectChildNode.isHidden) {
            expectChildrenKeys.push(childKey);
            if (expectFirstChildWithDiffKey === undefined) {
              expectFirstChildWithDiffKey = childKey;
            }
          }
        }
        expectNode.childrenKeys = expectChildrenKeys;
        expectNode.firstChildWithDiffKey = expectFirstChildWithDiffKey;
      }
      actualNode.childComparisonDiffMap = childComparisonDiffMap;
      expectNode.childComparisonDiffMap = childComparisonDiffMap;
    };
    const subcompareChildrenSolo = (node, placeholderNode) => {
      const childComparisonDiffMap = new Map();
      const childrenKeys = [];
      let firstChildWithDiffKey;
      for (const [childKey, childNode] of node.childNodeMap) {
        const soloChildComparison = subcompareSolo(childNode, placeholderNode);
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
      node.childrenKeys = childrenKeys;
      node.firstChildWithDiffKey = firstChildWithDiffKey;
      node.childComparisonDiffMap = childComparisonDiffMap;
    };

    const visitDuo = (actualNode, expectNode) => {
      if (actualNode.comparison) {
        throw new Error(`actualNode (${actualNode.subgroup}) already compared`);
      }
      actualNode.comparison = comparison;
      if (expectNode.comparison) {
        throw new Error(`expectNode (${expectNode.subgroup}) already compared`);
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
                actualNode.startMarker = " ".repeat(expectWidth - actualWidth);
              } else if (actualWidth > expectWidth) {
                expectNode.startMarker = " ".repeat(actualWidth - expectWidth);
              }
            }
          }
        }
      }
    };
    const visitSolo = (node, placeholderNode) => {
      if (node.comparison) {
        throw new Error(`node (${node.subgroup}) already compared`);
      }
      node.comparison = comparison;
      subcompareChildrenSolo(node, placeholderNode);
      if (node.isHiddenWhenSolo) {
        node.isHidden = true;
      }
    };

    visit: {
      if (actualNode.category === expectNode.category) {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      // not found in expected (added or expect cannot have this type of value)
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
      // custom comparison
      if (
        actualNode.category === "primitive" ||
        actualNode.category === "composite"
      ) {
        if (expectNode.customCompare) {
          expectNode.customCompare(actualNode, expectNode, {
            subcompareChildrenDuo,
            subcompareChildrenSolo,
            subcompareDuo,
            subcompareSolo,
            onSelfDiff,
          });
          break visit;
        }
      }

      // not same category
      onSelfDiff(`should_be_${expect.category}`);
      // primitive expected
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
      // composite expected
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
      if (node.diffType !== "") {
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
        node.color = node.colorWhenSame;
      } else {
        node.color = {
          solo: node.colorWhenSolo,
          modified: node.colorWhenModified,
          same: node.colorWhenSame,
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
      actualNode.subgroup === "url_internal_properties" &&
      expectNode.subgroup === "url_internal_properties"
    ) {
      forceSameQuotes(actualNode, expectNode);
    }

    return comparison;
  };

  const rootComparison = compare(actualRootNode, expectRootNode);
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
            rootNode.name === "actual" ? "actualNode" : "expectNode"
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
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const parentNode = currentNode.parent;
        if (!parentNode) {
          return rootNode;
        }
        if (!parentNode.isContainer && parentNode.depth === startDepth) {
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
      const actualStartNodePath = actualStartNode.path.toString();
      const expectStartNodePath = expectStartNode.path.toString();
      if (actualStartNodePath === expectStartNodePath) {
        infos.push(
          `diff starts at ${ANSI.color(actualStartNodePath, ANSI.YELLOW)}`,
        );
      } else {
        infos.push(
          `actual diff starts at ${ANSI.color(actualStartNodePath, ANSI.YELLOW)}`,
        );
        infos.push(
          `expect diff starts at ${ANSI.color(expectStartNodePath, ANSI.YELLOW)}`,
        );
      }
    } else if (actualStartNode !== actualRootNode) {
      infos.push(
        `actual diff starts at ${ANSI.color(actualStartNode.path, ANSI.YELLOW)}`,
      );
    } else if (expectStartNode !== expectRootNode) {
      infos.push(
        `expect diff starts at ${ANSI.color(expectStartNode.path, ANSI.YELLOW)}`,
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

  diff += ANSI.color("actual:", sameColor);
  diff += " ";
  diff += actualStartNode.render({
    MAX_DEPTH,
    MAX_DEPTH_INSIDE_DIFF,
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF,
    MAX_COLUMNS,
    columnsRemaining: MAX_COLUMNS - "actual: ".length,
    startNode: actualStartNode,
  });
  diff += `\n`;
  diff += ANSI.color("expect:", sameColor);
  diff += " ";
  diff += expectStartNode.render({
    MAX_DEPTH,
    MAX_DEPTH_INSIDE_DIFF,
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF,
    MAX_COLUMNS,
    columnsRemaining: MAX_COLUMNS - "expect: ".length,
    startNode: expectStartNode,
  });
  throw diff;
};

const comparerDefault = (actualNode, expectNode) => {
  if (actualNode.category === "primitive") {
    if (
      actualNode.value === expectNode.value &&
      actualNode.isNegativeZero === expectNode.isNegativeZero
    ) {
      return {
        result: "success",
        propagate: PLACEHOLDER_FOR_SAME,
      };
    }
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
    customCompare = createAssertMethodCustomCompare(
      (actualNode, expectArgValueNode, { subcompareDuo }) => {
        const expectArgComparison = subcompareDuo(
          actualNode,
          expectArgValueNode,
        );
        return expectArgComparison.hasAnyDiff
          ? PLACEHOLDER_FOR_MODIFIED
          : PLACEHOLDER_FOR_SAME;
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

assert.belowOrEquals = (value, { renderOnlyArgs } = {}) => {
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
    {
      renderOnlyArgs,
    },
  );
};
assert.aboveOrEquals = (value, { renderOnlyArgs } = {}) => {
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
    {
      renderOnlyArgs,
    },
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
    { value: assert.aboveOrEquals(minValue, { renderOnlyArgs: true }) },
    { value: assert.belowOrEquals(maxValue, { renderOnlyArgs: true }) },
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
        (actualNode, expectFirsArgValueNode, { subcompareDuo, onSelfDiff }) => {
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
  createRootNode = ({
    colorWhenSolo,
    colorWhenSame,
    colorWhenModified,
    name,
    value,
    render,
  }) => {
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
      id: nodeId,
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
      group: "root",
      value,
      parent: null,
      depth: 0,
      path: createValuePath([
        {
          type: "identifier",
          value: name,
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
    colorWhenSolo,
    colorWhenSame,
    colorWhenModified,
    name,
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
    quotesDisabled = false,
    quotesBacktickDisabled = false,
    numericSeparatorsDisabled = false,
    lineNumbersDisabled = false,
    onelineDiff = null,
    multilineDiff = null,
  }) => {
    const node = {
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
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
      // info
      isCustomExpectation: false,
      // info/primitive
      isUndefined: false,
      isString: false,
      isStringForUrl: false,
      isNumber: false,
      isNegativeZero: false,
      isInfinity: false,
      isNaN: false,
      isBigInt: false,
      isSymbol: false,
      // info/composite
      isFunction: false,
      functionAnalysis: defaultFunctionAnalysis,
      isArray: false,
      isTypedArray: false,
      isMap: false,
      isSet: false,
      isURL: false,
      isError: false,
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
    if (subgroup === "array_entry_key" || subgroup === "arg_entry_key") {
      node.category = "primitive";
      node.isNumber = true;
      return node;
    }
    if (subgroup === "char_entry_value") {
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
                value: "NaN",
                render: renderGrammar,
                group: "grammar",
                subgroup: "integer",
              });
              return;
            }
            if (node.isNegativeZero || Math.sign(value) === -1) {
              numberCompositionNode.appendChild("sign", {
                value: "-",
                render: renderGrammar,
                group: "grammar",
                subgroup: "number_sign",
              });
            }
            if (node.isNegativeZero) {
              numberCompositionNode.appendChild("integer", {
                value: "0",
                render: renderGrammar,
                group: "grammar",
                subgroup: "integer",
              });
              return;
            }
            if (node.isInfinity) {
              numberCompositionNode.appendChild("integer", {
                value: "Infinity",
                render: renderGrammar,
                group: "grammar",
                subgroup: "integer",
              });
              return;
            }
            // integer
            if (value % 1 === 0) {
              const { integer } = tokenizeInteger(Math.abs(value));
              numberCompositionNode.appendChild("integer", {
                value: numericSeparatorsDisabled
                  ? integer
                  : groupDigits(integer),
                render: renderGrammar,
                group: "grammar",
                subgroup: "integer",
              });
              return;
            }
            // float
            const { integer, decimalSeparator, decimal } = tokenizeFloat(
              Math.abs(value),
            );
            numberCompositionNode.appendChild("integer", {
              value: numericSeparatorsDisabled ? integer : groupDigits(integer),
              render: renderGrammar,
              separatorMarker: decimalSeparator,
              group: "grammar",
              subgroup: "integer",
            });
            numberCompositionNode.appendChild("decimal", {
              value: numericSeparatorsDisabled ? decimal : groupDigits(decimal),
              render: renderGrammar,
              group: "grammar",
              subgroup: "decimal",
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
      // some strings are rendered as is
      // - no quote escaping
      // - no line splitting
      if (group === "grammar") {
        return node;
      }
      if (subgroup === "url_search_entry_key") {
        // key in "?key=value" is rendered as is
        return node;
      }
      if (subgroup === "url_search_entry_value") {
        // value in "?key=value" is rendered as is
        return node;
      }
      if (isSourceCode) {
        return node;
      }
      let bestQuote;
      best_quote: {
        if (quotesDisabled) {
          break best_quote;
        }
        let backslashCount = 0;
        let doubleQuoteCount = 0;
        let singleQuoteCount = 0;
        let backtickCount = 0;
        for (const char of value) {
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
        bestQuote = (() => {
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
        })();
      }
      const quoteMarkerRef = { current: bestQuote };
      if (group !== "url_internal_prop" && canParseUrl(value)) {
        node.isStringForUrl = true;
        node.childGenerator = () => {
          const urlObject = new URL(value);
          const urlInternalPropertiesNode = node.appendChild(
            "url_internal_properties",
            {
              render: renderChildren,
              onelineDiff: {
                hasTrailingSeparator: true,
                skippedMarkers: {
                  start: "…",
                  between: "…",
                  end: "…",
                },
              },
              startMarker: bestQuote,
              endMarker: bestQuote,
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
                const appendUrlInternalProp = (name, value, params) => {
                  urlInternalPropertiesNode.appendChild(name, {
                    value,
                    render: renderValue,
                    group: "url_internal_prop",
                    subgroup: `url_${name}`,
                    quotesDisabled: true,
                    ...params,
                  });
                };

                appendUrlInternalProp("protocol", protocol, {
                  endMarker: "//",
                });

                if (username) {
                  appendUrlInternalProp("username", username, {
                    endMarker: password ? ":" : "@",
                  });
                  if (password) {
                    appendUrlInternalProp("password", password, {
                      endMarker: "@",
                    });
                  }
                }
                appendUrlInternalProp("hostname", hostname);

                if (port) {
                  appendUrlInternalProp("port", parseInt(port), {
                    startMarker: ":",
                    numericSeparatorsDisabled: true,
                  });
                }
                if (pathname) {
                  appendUrlInternalProp("pathname", pathname);
                }
                if (search) {
                  const urlSearchNode = urlInternalPropertiesNode.appendChild(
                    "search",
                    {
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
                                  const entryNode =
                                    urlSearchEntryNode.appendChild(valueIndex, {
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
                                  entryNode.appendChild("entry_key", {
                                    value: key,
                                    render: renderValue,
                                    startMarker:
                                      urlSearchEntryNode.key === 0 &&
                                      valueIndex === 0
                                        ? ""
                                        : "&",
                                    separatorMarker: "=",
                                    separatorMarkerWhenTruncated: "",
                                    quoteMarkerRef,
                                    group: "entry_key",
                                    subgroup: "url_search_entry_key",
                                  });
                                  entryNode.appendChild("entry_value", {
                                    value: values[valueIndex],
                                    render: renderValue,
                                    quoteMarkerRef,
                                    group: "entry_value",
                                    subgroup: "url_search_entry_value",
                                  });
                                  valueIndex++;
                                }
                              },
                            },
                          );
                          searchEntryIndex++;
                        }
                      },
                    },
                  );
                }
                if (hash) {
                  appendUrlInternalProp("hash", hash);
                }
              },
              group: "entries",
              subgroup: "url_internal_properties",
            },
          );
        };
        return node;
      }
      node.childGenerator = () => {
        const lineEntriesNode = node.appendChild("line_entries", {
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
          group: "entries",
          subgroup: "line_entries",
          childGenerator: () => {
            let isMultiline = false;
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
                  value: char,
                  render: renderChar,
                  quoteMarkerRef,
                  group: "entry_value",
                  subgroup: "char_entry_value",
                });
              };
              return {
                node: lineNode,
                appendCharNode,
              };
            };
            const chars = tokenizeString(value);
            let currentLineEntry = appendLineEntry(0);
            let lineIndex = 0;
            let charIndex = 0;
            for (const char of chars) {
              if (char !== "\n") {
                currentLineEntry.appendCharNode(charIndex, char);
                charIndex++;
                continue;
              }
              isMultiline = true;
              lineIndex++;
              charIndex = 0;
              currentLineEntry = appendLineEntry(lineIndex);
            }
            if (isMultiline) {
              enableMultilineDiff(lineEntriesNode);
            } else {
              const firstLineNode = currentLineEntry.node;
              if (bestQuote) {
                firstLineNode.onelineDiff.hasMarkersWhenEmpty = true;
                firstLineNode.startMarker = firstLineNode.endMarker = bestQuote;
              }
            }
          },
        });
      };
      return node;
    }
    if (typeofResult === "symbol") {
      node.category = "primitive";
      node.isSymbol = true;
      node.childGenerator = () => {
        const wellKnownPath = getWellKnownValuePath(value);
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
                  value: part.value,
                  render: renderGrammar,
                  group: "grammar",
                  subgroup: "path",
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
      node.childGenerator = function () {
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
                  value: path.value,
                  render: renderGrammar,
                  group: "grammar",
                  subgroup: "path",
                });
                index++;
              }
            },
          });
          return;
        }
        const wellKnownPath = getWellKnownValuePath(value);
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
                  value: part.value,
                  render: renderGrammar,
                  group: "grammar",
                  subgroup: "path",
                });
                index++;
              }
            },
          });
          return;
        }
        const compositePartsNode = node.appendChild("parts", {
          render: renderChildren,
          onelineDiff: {
            hasSpacingBetweenEachChild: true,
            hasTrailingSeparator: true,
          },
          childGenerator: () => {
            const ownPropertyNameToIgnoreSet = new Set();
            const ownPropertSymbolToIgnoreSet = new Set();
            let objectConstructNode = null;
            let objectConstructArgs = null;
            // function child nodes
            if (node.isFunction) {
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
                        value: "class",
                        render: renderGrammar,
                        group: "grammar",
                        subgroup: "class_keyword",
                      });
                      if (node.functionAnalysis.name) {
                        functionConstructNode.appendChild("function_name", {
                          value: node.functionAnalysis.name,
                          render: renderGrammar,
                          group: "grammar",
                          subgroup: "function_name",
                        });
                      }
                      const extendedClassName =
                        node.functionAnalysis.extendedClassName;
                      if (extendedClassName) {
                        functionConstructNode.appendChild(
                          "class_extends_keyword",
                          {
                            value: "extends",
                            render: renderGrammar,
                            group: "grammar",
                            subgroup: "class_extends_keyword",
                          },
                        );
                        functionConstructNode.appendChild(
                          "class_extended_name",
                          {
                            value: extendedClassName,
                            render: renderGrammar,
                            group: "grammar",
                            subgroup: "class_extended_name",
                          },
                        );
                      }
                      return;
                    }
                    if (node.functionAnalysis.isAsync) {
                      functionConstructNode.appendChild(
                        "function_async_keyword",
                        {
                          value: "async",
                          render: renderGrammar,
                          group: "grammar",
                          subgroup: "function_async_keyword",
                        },
                      );
                    }
                    if (node.functionAnalysis.type === "classic") {
                      functionConstructNode.appendChild("function_keyword", {
                        value: node.functionAnalysis.isGenerator
                          ? "function*"
                          : "function",
                        render: renderGrammar,
                        group: "grammar",
                        subgroup: "function_keyword",
                      });
                    }
                    if (node.functionAnalysis.name) {
                      functionConstructNode.appendChild("function_name", {
                        value: node.functionAnalysis.name,
                        render: renderGrammar,
                        group: "grammar",
                        subgroup: "function_name",
                      });
                    }
                    function_body_prefix: {
                      const appendFunctionBodyPrefix = (prefix) => {
                        functionConstructNode.appendChild(
                          "function_body_prefix",
                          {
                            value: prefix,
                            render: renderGrammar,
                            group: "grammar",
                            subgroup: "function_body_prefix",
                          },
                        );
                      };

                      if (node.functionAnalysis.type === "arrow") {
                        appendFunctionBodyPrefix("() =>");
                      } else if (node.functionAnalysis.type === "method") {
                        if (node.functionAnalysis.getterName) {
                          appendFunctionBodyPrefix(`get ${key}()`);
                        } else if (node.functionAnalysis.setterName) {
                          appendFunctionBodyPrefix(`set ${key}()`);
                        } else {
                          appendFunctionBodyPrefix(`${key}()`);
                        }
                      } else if (node.functionAnalysis.type === "classic") {
                        appendFunctionBodyPrefix("()");
                      }
                    }
                  },
                },
              );
            } else if (isFunctionPrototype) {
            } else {
              const objectTag = getObjectTag(value);
              if (node.isError) {
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
                    childGenerator: () => {
                      errorConstructNode.appendChild("error_constructor", {
                        value: objectTag,
                        render: renderGrammar,
                        separatorMarker: ": ",
                      });
                      if (messageOwnPropertyDescriptor) {
                        const errorMessage = messageOwnPropertyDescriptor.value;
                        errorConstructNode.appendChild("error_message", {
                          value: errorMessage,
                          render: renderString,
                          lineNumbersDisabled: true,
                          quotesDisabled: true,
                          subgroup: "error_message",
                        });
                      }
                    },
                  },
                );
              } else if (
                objectTag &&
                objectTag !== "Object" &&
                objectTag !== "Array"
              ) {
                objectConstructNode = compositePartsNode.appendChild(
                  "construct",
                  {
                    value: null,
                    render: renderChildren,
                    onelineDiff: {
                      hasSpacingBetweenEachChild: true,
                    },
                    group: "entries",
                    subgroup: "object_construct",
                    childGenerator() {
                      if (objectConstructArgs) {
                        objectConstructNode.appendChild(
                          "call",
                          createMethodCallNode(objectConstructNode, {
                            objectName: objectTag,
                            args: objectConstructArgs,
                          }),
                        );
                      } else {
                        objectConstructNode.appendChild("object_tag", {
                          value: objectTag,
                          render: renderGrammar,
                          group: "grammar",
                          subgroup: "object_tag",
                          path: node.path.append("[[ObjectTag]]"),
                        });
                      }
                    },
                  },
                );
              }
            }
            let canHaveInternalEntries = false;
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
                canHaveInternalEntries = true;
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
                        });
                        mapEntryNode.appendChild("entry_value", {
                          value: mapEntryValue,
                          render: renderValue,
                          separatorMarker: ",",
                          group: "entry_value",
                          subgroup: "map_entry_value",
                        });
                      }
                      objectTagCounterMap.clear();
                    },
                  },
                );
              }
              if (node.isSet) {
                canHaveInternalEntries = true;
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
                        });
                        index++;
                      }
                    },
                  },
                );
              }
            }
            let canHaveIndexedEntries = false;
            indexed_entries: {
              if (node.isArray) {
                canHaveIndexedEntries = true;
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
                    });
                    index++;
                  }
                };
                arrayChildrenGenerator();
                break indexed_entries;
              }
              if (node.isTypedArray) {
                canHaveIndexedEntries = true;
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
                    });
                    index++;
                  }
                };
                typedArrayChildrenGenerator();
              }
            }
            const propertyLikeCallbackSet = new Set();
            symbol_to_primitive: {
              if (
                Symbol.toPrimitive in value &&
                typeof value[Symbol.toPrimitive] === "function"
              ) {
                ownPropertSymbolToIgnoreSet.add(Symbol.toPrimitive);
                const toPrimitiveReturnValue =
                  value[Symbol.toPrimitive]("string");
                propertyLikeCallbackSet.add((appendPropertyEntryNode) => {
                  appendPropertyEntryNode(
                    SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY,
                    {
                      value: toPrimitiveReturnValue,
                    },
                  );
                });
              }
            }
            // toString()
            if (node.isURL) {
              objectConstructArgs = [
                {
                  value: value.href,
                  key: "toString()",
                },
              ];
            }
            // valueOf()
            else if (
              typeof value.valueOf === "function" &&
              value.valueOf !== Object.prototype.valueOf
            ) {
              ownPropertyNameToIgnoreSet.add("valueOf");
              const valueOfReturnValue = value.valueOf();
              if (objectConstructNode) {
                objectConstructArgs = [
                  {
                    value: valueOfReturnValue,
                    key: "valueOf()",
                  },
                ];
              } else {
                propertyLikeCallbackSet.add((appendPropertyEntryNode) => {
                  appendPropertyEntryNode(VALUE_OF_RETURN_VALUE_ENTRY_KEY, {
                    value: valueOfReturnValue,
                  });
                });
              }
            }
            own_properties: {
              const ownPropertySymbols = Object.getOwnPropertySymbols(
                value,
              ).filter((ownPropertySymbol) => {
                return (
                  !ownPropertSymbolToIgnoreSet.has(ownPropertySymbol) &&
                  !shouldIgnoreOwnPropertySymbol(node, ownPropertySymbol)
                );
              });
              const ownPropertyNames = Object.getOwnPropertyNames(value).filter(
                (ownPropertyName) => {
                  return (
                    !ownPropertyNameToIgnoreSet.has(ownPropertyName) &&
                    !shouldIgnoreOwnPropertyName(node, ownPropertyName)
                  );
                },
              );
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
                node.isError;
              const skipOwnProperties =
                canSkipOwnProperties &&
                ownPropertySymbols.length === 0 &&
                ownPropertyNames.length === 0 &&
                propertyLikeCallbackSet.size === 0;
              if (skipOwnProperties) {
                break own_properties;
              }
              const hasMarkersWhenEmpty =
                !objectConstructNode &&
                !canHaveInternalEntries &&
                !canHaveIndexedEntries;
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
                    const appendPropertyEntryNode = (
                      key,
                      {
                        value,
                        isSourceCode,
                        isFunctionPrototype,
                        isClassPrototype,
                        isHiddenWhenSame,
                      },
                    ) => {
                      const ownPropertyNode = ownPropertiesNode.appendChild(
                        key,
                        {
                          render: renderChildren,
                          onelineDiff: {
                            hasTrailingSeparator: true,
                          },
                          focusedChildIndex: 0,
                          isFunctionPrototype,
                          isClassPrototype,
                          isHiddenWhenSame,
                          childGenerator: () => {
                            const valueFunctionAnalysis =
                              tokenizeFunction(value);
                            if (
                              node.functionAnalysis.type === "class" &&
                              !isClassPrototype
                            ) {
                              ownPropertyNode.appendChild("static_keyword", {
                                render: renderGrammar,
                                separatorMarker: " ",
                                group: "grammar",
                                subgroup: "static_keyword",
                                value: "static",
                                isHidden:
                                  isSourceCode ||
                                  valueFunctionAnalysis.type === "method",
                              });
                            }
                            ownPropertyNode.appendChild("entry_key", {
                              value: key,
                              render: renderPrimitive,
                              quotesDisabled:
                                typeof key === "string" &&
                                isValidPropertyIdentifier(key),
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
                              subgroup: "property_entry_key",
                              isHidden:
                                isSourceCode ||
                                valueFunctionAnalysis.type === "method" ||
                                isClassPrototype,
                            });
                            ownPropertyNode.appendChild("entry_value", {
                              key,
                              value,
                              render: renderValue,
                              separatorMarker:
                                node.functionAnalysis.type === "class"
                                  ? ";"
                                  : ",",
                              group: "entry_value",
                              subgroup: "property_entry_value",
                              isSourceCode,
                              isFunctionPrototype,
                              isClassPrototype,
                            });
                          },
                          group: "entry",
                          subgroup: "property_entry",
                          path: node.path.append(key),
                        },
                      );
                      return ownPropertyNode;
                    };

                    if (node.isFunction) {
                      appendPropertyEntryNode(SOURCE_CODE_ENTRY_KEY, {
                        value: node.functionAnalysis.argsAndBodySource,
                        isSourceCode: true,
                      });
                    }
                    for (const ownPropertySymbol of ownPropertySymbols) {
                      const ownPropertySymbolValue =
                        node.value[ownPropertySymbol];
                      appendPropertyEntryNode(ownPropertySymbol, {
                        value: ownPropertySymbolValue,
                        isHiddenWhenSame: true,
                      });
                    }
                    for (const ownPropertyName of ownPropertyNames) {
                      const ownPropertyValue = node.value[ownPropertyName];
                      appendPropertyEntryNode(ownPropertyName, {
                        value: ownPropertyValue,
                        isFunctionPrototype:
                          ownPropertyName === "prototype" && node.isFunction,
                        isClassPrototype:
                          ownPropertyName === "prototype" &&
                          node.functionAnalysis.type === "class",
                      });
                    }
                    for (const propertyLikeCallback of propertyLikeCallbackSet) {
                      propertyLikeCallback(appendPropertyEntryNode);
                    }
                  },
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
            return symbolToPrimitiveReturnValuePropertyNode.childNodeMap.get(
              "entry_value",
            );
          }
          const valueOfReturnValuePropertyNode =
            ownPropertiesNode.childNodeMap.get(VALUE_OF_RETURN_VALUE_ENTRY_KEY);
          if (valueOfReturnValuePropertyNode) {
            return valueOfReturnValuePropertyNode.childNodeMap.get(
              "entry_value",
            );
          }
        }
        return null;
      };
      return node;
    }
    node.category = "primitive";
    return node;
  };

  const referenceFromOthersSetDefault = new Set();

  const appendChildNodeGeneric = (node, childKey, params) => {
    const childNode = createNode({
      id: node.nextId(),
      colorWhenSolo: node.colorWhenSolo,
      colorWhenSame: node.colorWhenSame,
      colorWhenModified: node.colorWhenModified,
      name: node.name,
      parent: node,
      path: node.path,
      referenceMap: node.referenceMap,
      nextId: node.nextId,
      depth:
        params.group === "entries" ||
        params.group === "entry" ||
        params.group === "grammar" ||
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

const renderValue = (node, props) => {
  if (node.category === "primitive") {
    return renderPrimitive(node, props);
  }
  return renderComposite(node, props);
};
const renderPrimitive = (node, props) => {
  if (props.columnsRemaining < 1) {
    return setColor("…", node.color);
  }
  if (node.isSourceCode) {
    return truncateAndApplyColor("[source code]", node, props);
  }
  if (node.isUndefined) {
    return truncateAndApplyColor("undefined", node, props);
  }
  if (node.isString) {
    return renderString(node, props);
  }
  if (node.isSymbol) {
    return renderSymbol(node, props);
  }
  if (node.isNumber) {
    return renderNumber(node, props);
  }
  if (node.isBigInt) {
    return truncateAndApplyColor(`${node.value}n`, node, props);
  }
  return truncateAndApplyColor(JSON.stringify(node.value), node, props);
};
const renderString = (node, props) => {
  if (node.value === VALUE_OF_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndApplyColor("valueOf()", node, props);
  }
  if (node.value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndApplyColor("[Symbol.toPrimitive()]", node, props);
  }
  if (node.isStringForUrl) {
    const urlInternalPropertiesNode = node.childNodeMap.get(
      "url_internal_properties",
    );
    return urlInternalPropertiesNode.render(props);
  }
  const lineEntriesNode = node.childNodeMap.get("line_entries");
  if (lineEntriesNode) {
    return lineEntriesNode.render(props);
  }
  const quoteToEscape = node.quoteMarkerRef?.current;
  if (quoteToEscape) {
    let diff = "";
    for (const char of node.value) {
      if (char === quoteToEscape) {
        diff += `\\${char}`;
      } else {
        diff += char;
      }
    }
    return truncateAndApplyColor(diff, node, props);
  }
  return truncateAndApplyColor(node.value, node, props);
};
const renderEmptyValue = (node, props) => {
  return truncateAndApplyColor("empty", node, props);
};
const renderChar = (node, props) => {
  const char = node.value;
  const { quoteMarkerRef } = node;
  if (quoteMarkerRef && char === quoteMarkerRef.current) {
    return truncateAndApplyColor(`\\${char}`, node, props);
  }
  const point = char.charCodeAt(0);
  if (point === 92 || point < 32 || (point > 126 && point < 160)) {
    return truncateAndApplyColor(CHAR_TO_ESCAPED_CHAR[point], node, props);
  }
  return truncateAndApplyColor(char, node, props);
};
const renderNumber = (node, props) => {
  const numberCompositionNode = node.childNodeMap.get("composition");
  if (numberCompositionNode) {
    return numberCompositionNode.render(props);
  }
  return truncateAndApplyColor(JSON.stringify(node.value), node, props);
};
const renderSymbol = (node, props) => {
  const wellKnownNode = node.childNodeMap.get("well_known");
  if (wellKnownNode) {
    return wellKnownNode.render(props);
  }
  const symbolConstructNode = node.childNodeMap.get("symbol_construct");
  return symbolConstructNode.render(props);
};
const renderGrammar = (node, props) => {
  return truncateAndApplyColor(node.value, node, props);
};
const truncateAndApplyColor = (valueDiff, node, props) => {
  const { columnsRemaining } = props;
  if (columnsRemaining < 1) {
    return props.endSkippedMarkerDisabled ? "" : setColor("…", node.color);
  }
  let columnsRemainingForValue = columnsRemaining;
  let { startMarker, endMarker } = node;
  if (startMarker) {
    columnsRemainingForValue -= startMarker.length;
  }
  if (endMarker) {
    columnsRemainingForValue -= endMarker.length;
  }
  if (columnsRemainingForValue < 1) {
    return props.endSkippedMarkerDisabled ? "" : setColor("…", node.color);
  }
  if (valueDiff.length > columnsRemainingForValue) {
    if (props.endSkippedMarkerDisabled) {
      valueDiff = valueDiff.slice(0, columnsRemainingForValue);
    } else {
      valueDiff = valueDiff.slice(0, columnsRemainingForValue - "…".length);
      valueDiff += "…";
    }
  }
  let diff = "";
  if (startMarker) {
    diff += startMarker;
  }
  diff += valueDiff;
  if (endMarker) {
    diff += endMarker;
  }
  diff = setColor(diff, node.color);
  return diff;
};

const renderComposite = (node, props) => {
  // it's here that at some point we'll compare more than just own properties
  // because composite also got a prototype
  // and a constructor that might differ
  let diff = "";
  if (props.columnsRemaining < 2) {
    diff = setColor("…", node.color);
    return diff;
  }
  const referenceNode = node.childNodeMap.get("reference");
  if (referenceNode) {
    return referenceNode.render(props);
  }
  const wellKnownNode = node.childNodeMap.get("well_known");
  if (wellKnownNode) {
    return wellKnownNode.render(props);
  }
  let maxDepthReached = false;
  if (node.diffType === "same") {
    maxDepthReached = node.depth > props.MAX_DEPTH;
  } else if (typeof props.firstDiffDepth === "number") {
    maxDepthReached =
      node.depth + props.firstDiffDepth > props.MAX_DEPTH_INSIDE_DIFF;
  } else {
    props.firstDiffDepth = node.depth;
    maxDepthReached = node.depth > props.MAX_DEPTH_INSIDE_DIFF;
  }
  const compositePartsNode = node.childNodeMap.get("parts");
  if (maxDepthReached) {
    node.startMarker = node.endMarker = "";
    // const { separatorMarkerRef } = node;
    // if (separatorMarkerRef) {
    //   separatorMarkerRef.current = "";
    // }
    const indexedEntriesNode =
      compositePartsNode.childNodeMap.get("indexed_entries");
    if (indexedEntriesNode) {
      const arrayLength = indexedEntriesNode.childNodeMap.size;
      return truncateAndApplyColor(`Array(${arrayLength})`, node, props);
    }
    const ownPropertiesNode =
      compositePartsNode.childNodeMap.get("own_properties");
    const ownPropertyCount = ownPropertiesNode.childNodeMap.size;
    return truncateAndApplyColor(`Object(${ownPropertyCount})`, node, props);
  }
  return compositePartsNode.render(props);
};
const renderChildren = (node, props) => {
  const {
    hasMarkersWhenEmpty,
    focusedChildWhenSame = "first",
    separatorBetweenEachChildDisabled,
    hasSeparatorOnSingleChild,
    hasTrailingSeparator,
    hasSpacingAroundChildren,
    hasSpacingBetweenEachChild,
    skippedMarkers,
    skippedMarkersPlacement = "inside",
    childrenVisitMethod = "pick_around_starting_before",
  } = node.onelineDiff;
  let startSkippedMarker = "";
  let endSkippedMarker = "";
  if (skippedMarkers) {
    startSkippedMarker = skippedMarkers.start;
    endSkippedMarker = skippedMarkers.end;
    if (props.startSkippedMarkerDisabled) {
      startSkippedMarker = "";
    }
    if (props.endSkippedMarkerDisabled) {
      endSkippedMarker = "";
    }
  }
  const renderSkippedSection = (fromIndex, toIndex) => {
    let skippedMarker = fromIndex === 0 ? startSkippedMarker : endSkippedMarker;
    if (!skippedMarker) {
      return "";
    }
    // to pick the color we'll check each child
    let skippedChildIndex = fromIndex;
    let color = node.color;
    while (skippedChildIndex !== toIndex) {
      skippedChildIndex++;
      const skippedChildKey = childrenKeys[skippedChildIndex];
      const skippedChild = node.childNodeMap.get(skippedChildKey);
      if (skippedChild.diffType === "modified") {
        color = skippedChild.color;
        break;
      }
      if (skippedChild.diffType === "solo") {
        color = skippedChild.color;
      }
    }
    let diff = "";
    if (fromIndex > 0 && hasSpacingBetweenEachChild) {
      diff += " ";
    }
    diff += setColor(skippedMarker, color);
    return diff;
  };

  const childrenKeys = node.childrenKeys;
  let columnsRemainingForChildren = props.columnsRemaining;
  if (columnsRemainingForChildren < 1) {
    return renderSkippedSection(0, childrenKeys.length - 1);
  }
  const { startMarker, endMarker } = node;
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let minIndex = -1;
  let maxIndex = Infinity;
  let { focusedChildIndex } = node;
  focused_child_index: {
    const { rangeToDisplay } = node;
    if (rangeToDisplay) {
      if (rangeToDisplay.min !== 0) {
        minIndex = rangeToDisplay.min;
      }
      // maxIndex = rangeToDisplay.end;
      focusedChildIndex = rangeToDisplay.start;
    } else if (focusedChildIndex === undefined) {
      const { firstChildWithDiffKey } = node;
      if (firstChildWithDiffKey === undefined) {
        // added/removed
        if (node.childComparisonDiffMap.size > 0) {
          focusedChildIndex = childrenKeys.length - 1;
          const { otherNode } = node;
          if (otherNode.placeholder) {
          } else if (otherNode.displayedRange) {
            minIndex = otherNode.displayedRange.min;
          } else {
            otherNode.render(props);
            minIndex = otherNode.displayedRange.min;
          }
        }
        // same
        else if (focusedChildWhenSame === "first") {
          focusedChildIndex = 0;
        } else if (focusedChildWhenSame === "last") {
          focusedChildIndex = childrenKeys.length - 1;
        } else {
          focusedChildIndex = Math.floor(childrenKeys.length / 2);
        }
      } else {
        focusedChildIndex = childrenKeys.indexOf(firstChildWithDiffKey);
      }
    }
  }
  let hasSomeChildSkippedAtStart = focusedChildIndex > 0;
  let hasSomeChildSkippedAtEnd = focusedChildIndex < childrenKeys.length - 1;
  const startSkippedMarkerWidth = startSkippedMarker.length;
  const endSkippedMarkerWidth = endSkippedMarker.length;
  const { separatorMarker, separatorMarkerWhenTruncated } = node;

  let boilerplate = "";
  boilerplate_space: {
    if (hasSomeChildSkippedAtStart) {
      if (skippedMarkersPlacement === "inside") {
        if (hasSpacingAroundChildren) {
          boilerplate = `${startMarker} ${startSkippedMarker}`;
        } else {
          boilerplate = `${startMarker}${startSkippedMarker}`;
        }
      } else {
        boilerplate = `${startSkippedMarker}${startMarker}`;
      }
    } else {
      boilerplate = startMarker;
    }
    if (hasSomeChildSkippedAtEnd) {
      if (skippedMarkersPlacement === "inside") {
        if (hasSpacingAroundChildren) {
          boilerplate += `${endSkippedMarker} ${endMarker}`;
        } else {
          boilerplate += `${endSkippedMarker}${endMarker}`;
        }
      } else {
        boilerplate += `${endMarker}${endSkippedMarker}`;
      }
    } else {
      boilerplate += endMarker;
    }
    if (separatorMarker) {
      boilerplate += separatorMarker;
    }
    const columnsRemainingForChildrenConsideringBoilerplate =
      columnsRemainingForChildren - boilerplate.length;
    if (columnsRemainingForChildrenConsideringBoilerplate < 0) {
      return renderSkippedSection(0, childrenKeys.length - 1);
    }
    if (columnsRemainingForChildrenConsideringBoilerplate === 0) {
      return skippedMarkersPlacement === "inside"
        ? setColor(boilerplate, node.color)
        : renderSkippedSection(0, childrenKeys.length - 1);
    }
  }

  let childrenDiff = "";
  let tryToSwapSkipMarkerWithChild = false;
  let columnsNeededBySkipMarkers = 0;
  let isFirstAppend = true;
  const appendChildDiff = (childDiff, childIndex) => {
    if (isFirstAppend) {
      isFirstAppend = false;
      minIndexDisplayed = maxIndexDisplayed = childIndex;
      return childDiff;
    }
    if (childIndex < minIndexDisplayed) {
      minIndexDisplayed = childIndex;
    } else if (childIndex > maxIndexDisplayed) {
      maxIndexDisplayed = childIndex;
    }
    const isPrevious = childIndex < focusedChildIndex;
    if (isPrevious) {
      if (childrenDiff) {
        return `${childDiff}${childrenDiff}`;
      }
      return childDiff;
    }
    if (childrenDiff) {
      return `${childrenDiff}${childDiff}`;
    }
    return childDiff;
  };
  if (hasSpacingAroundChildren) {
    columnsRemainingForChildren -=
      `${startMarker}  ${endMarker}${separatorMarkerWhenTruncated ? separatorMarkerWhenTruncated : separatorMarker}`
        .length;
  } else {
    columnsRemainingForChildren -=
      `${startMarker}${endMarker}${separatorMarkerWhenTruncated ? separatorMarkerWhenTruncated : separatorMarker}`
        .length;
  }
  let minIndexDisplayed = Infinity;
  let maxIndexDisplayed = -1;
  for (const childIndex of generateChildIndexes(childrenKeys, {
    startIndex: focusedChildIndex,
    minIndex,
    maxIndex,
    childrenVisitMethod,
  })) {
    if (columnsRemainingForChildren <= 0) {
      break;
    }
    const childKey = childrenKeys[childIndex];
    const childNode = node.childNodeMap.get(childKey);
    if (!childNode) {
      // happens when forcing a specific range to be rendered
      continue;
    }
    const minIndexDisplayedCandidate =
      childIndex < minIndexDisplayed ? childIndex : minIndexDisplayed;
    const maxIndexDisplayedCandidate =
      childIndex > maxIndexDisplayed ? childIndex : maxIndexDisplayed;
    const hasSomeChildSkippedAtStartCandidate =
      minIndexDisplayedCandidate !== 0;
    const hasSomeChildSkippedAtEndCandidate =
      maxIndexDisplayedCandidate !== childrenKeys.length - 1;
    columnsNeededBySkipMarkers = 0;
    if (hasSomeChildSkippedAtStartCandidate) {
      columnsNeededBySkipMarkers += startSkippedMarkerWidth;
    }
    if (hasSomeChildSkippedAtEndCandidate) {
      if (hasSpacingBetweenEachChild) {
        columnsNeededBySkipMarkers += " ".length;
      }
      columnsNeededBySkipMarkers += endSkippedMarkerWidth;
    }
    let columnsRemainingForThisChild;
    if (tryToSwapSkipMarkerWithChild) {
      // "ab" makes more sense than "a…"
      // So if next child is the last and not too large
      // it will be allowed to fully replace the skip marker
      // But we must allow next child to take as much space as it needs
      // (hence we reset columnsRemainingForThisChild)
      // Otherwise it will be truncated and we'll think it take exactly the skip marker width
      // (That would lead to "http://example.com/dir/file.js" becoming "http://example/" instead of "http://example…")
      columnsRemainingForThisChild = props.columnsRemaining;
    } else {
      columnsRemainingForThisChild = columnsRemainingForChildren;
    }
    columnsRemainingForThisChild -= columnsNeededBySkipMarkers;
    let {
      separatorMarker,
      separatorMarkerWhenTruncated,
      separatorMarkerDisabled,
    } = childNode;
    if (separatorMarkerDisabled) {
    } else if (
      separatorBetweenEachChildDisabled ||
      shouldDisableSeparator(childIndex, childrenKeys, {
        hasSeparatorOnSingleChild,
        hasTrailingSeparator,
      })
    ) {
      separatorMarkerDisabled = true;
      if (childNode.subgroup === "property_entry") {
        const propertyValueNode = childNode.childNodeMap.get("entry_value");
        propertyValueNode.separatorMarkerDisabled = true;
      }
    }
    if (separatorMarkerWhenTruncated === undefined) {
      columnsRemainingForThisChild -= separatorMarkerDisabled
        ? 0
        : separatorMarker.length;
    } else {
      columnsRemainingForThisChild -= separatorMarkerWhenTruncated.length;
    }
    // let shouldInjectSpacingAfter;
    // if (hasSpacingBetweenEachChild && childrenKeys.length > 1) {
    //   if (childIndex < focusedChildIndex) {
    //     if (childIndex > 0 || focusedChildIndex > 0) {
    //       const nextChildIndex = childIndex + 1;
    //       const nextChildKey = childrenKeys[nextChildIndex];
    //       if (nextChildKey !== undefined) {
    //         const nextChildNode = node.childNodeMap.get(nextChildKey);
    //         if (nextChildNode.hasLeftSpacingDisabled) {
    //         } else if (childrenDiff) {
    //           shouldInjectSpacingAfter = true;
    //           columnsRemainingForThisChild -= " ".length;
    //         }
    //       }
    //     }
    //   } else {
    //     // spacing avant, sauf si lui meme veut pas
    //     if (childNode.hasLeftSpacingDisabled) {
    //     } else {
    //       diff += " ";
    //       columnsRemainingForThisChild -= " ".length;
    //     }
    //   }
    // }
    const canSkipMarkers =
      node.subgroup === "url_internal_properties" ||
      node.subgroup === "array_entries";
    let childDiff = childNode.render({
      ...props,
      columnsRemaining: columnsRemainingForThisChild,
      startSkippedMarkerDisabled:
        canSkipMarkers && hasSomeChildSkippedAtStart && startSkippedMarkerWidth,
      endSkippedMarkerDisabled:
        canSkipMarkers && hasSomeChildSkippedAtEnd && endSkippedMarkerWidth,
      separatorMarker,
      forceDisableSeparatorMarker: () => {
        separatorMarkerDisabled = true;
      },
    });
    if (childDiff === "") {
      // child has been truncated (well we can't tell 100% this is the reason)
      // but for now let's consider this to be true
      break;
    }
    let childDiffWidth;
    const newLineIndex = childDiff.indexOf("\n");
    if (newLineIndex === -1) {
      childDiffWidth = stringWidth(childDiff);
    } else {
      const newLineLastIndex = childDiff.lastIndexOf("\n");
      if (newLineLastIndex === newLineIndex) {
        const line = childDiff.slice(0, newLineIndex + "\n".length);
        childDiffWidth = stringWidth(line);
      } else {
        const lastLine = childDiff.slice(newLineLastIndex + "\n".length);
        childDiffWidth = stringWidth(lastLine);
      }
    }
    if (!isFirstAppend && hasSpacingBetweenEachChild) {
      if (childIndex < focusedChildIndex) {
        if ((childIndex > 0 || focusedChildIndex > 0) && childrenDiff) {
          let shouldInjectSpacing = true;
          const nextChildIndex = childIndex + 1;
          const nextChildKey = childrenKeys[nextChildIndex];
          if (nextChildKey !== undefined) {
            const nextChildNode = node.childNodeMap.get(nextChildKey);
            if (nextChildNode.hasLeftSpacingDisabled) {
              shouldInjectSpacing = false;
            }
          }
          if (shouldInjectSpacing) {
            childDiffWidth += " ".length;
            childDiff = `${childDiff} `;
          }
        }
      } else if (childNode.hasLeftSpacingDisabled) {
      } else {
        childDiffWidth += " ".length;
        childDiff = ` ${childDiff}`;
      }
    }
    let separatorMarkerToAppend;
    let separatorWhenTruncatedUsed = false;
    if (separatorMarkerWhenTruncated === undefined) {
      separatorMarkerToAppend = separatorMarkerDisabled ? "" : separatorMarker;
    } else {
      const remainingColumns = columnsRemainingForChildren - childDiffWidth;
      if (remainingColumns > separatorMarker.length + 1) {
        separatorMarkerToAppend = separatorMarkerDisabled
          ? ""
          : separatorMarker;
      } else {
        separatorMarkerToAppend = separatorMarkerWhenTruncated;
        separatorWhenTruncatedUsed = true;
      }
    }
    if (separatorMarkerToAppend) {
      if (childNode.diffType === "solo") {
        childDiffWidth += separatorMarkerToAppend.length;
        childDiff += setColor(separatorMarkerToAppend, childNode.color);
      } else {
        childDiffWidth += separatorMarkerToAppend.length;
        childDiff += setColor(separatorMarkerToAppend, node.color);
      }
    }
    if (childDiffWidth > columnsRemainingForChildren) {
      break;
    }
    if (
      childDiffWidth + columnsNeededBySkipMarkers >
      columnsRemainingForChildren
    ) {
      break;
    }
    hasSomeChildSkippedAtStart = hasSomeChildSkippedAtStartCandidate;
    hasSomeChildSkippedAtEnd = hasSomeChildSkippedAtEndCandidate;
    columnsRemainingForChildren -= childDiffWidth;
    childrenDiff = appendChildDiff(childDiff, childIndex);
    if (separatorWhenTruncatedUsed) {
      break;
    }
    // if I had to stop there, I would put some markers
    // so I need to reserve that space
    // if I have exactly the spot I can still try to replace
    // skip marker by the actual next/prev child
    // ONLY if it can replace the marker (it's the first/last child)
    // AND it does take less or same width as marker
    if (
      columnsNeededBySkipMarkers > 0 &&
      columnsNeededBySkipMarkers === columnsRemainingForChildren
    ) {
      if (tryToSwapSkipMarkerWithChild) {
        // can we try again?
        break;
      }
      tryToSwapSkipMarkerWithChild = true;
    }
  }
  node.displayedRange = {
    min: minIndexDisplayed,
    start: focusedChildIndex,
    max: maxIndexDisplayed,
  };
  if (minIndexDisplayed === Infinity || maxIndexDisplayed === -1) {
    return skippedMarkersPlacement === "inside"
      ? setColor(boilerplate, node.color)
      : renderSkippedSection(0, childrenKeys.length - 1);
  }
  let diff = "";
  if (hasSomeChildSkippedAtStart) {
    if (skippedMarkersPlacement === "inside") {
      if (startMarker) {
        diff += setColor(startMarker, node.color);
      }
      diff += renderSkippedSection(0, minIndexDisplayed);
    } else {
      diff += renderSkippedSection(0, minIndexDisplayed);
      if (startMarker) {
        diff += setColor(startMarker, node.color);
      }
    }
  } else if (startMarker) {
    diff += setColor(startMarker, node.color);
  }
  if (hasSpacingAroundChildren) {
    diff += " ";
  }
  diff += childrenDiff;
  if (hasSpacingAroundChildren) {
    diff += " ";
  }
  if (hasSomeChildSkippedAtEnd) {
    if (skippedMarkersPlacement === "inside") {
      diff += renderSkippedSection(
        maxIndexDisplayed + 1,
        childrenKeys.length - 1,
      );
      if (endMarker) {
        diff += setColor(endMarker, node.color);
      }
    } else {
      if (endMarker) {
        diff += setColor(endMarker, node.color);
      }
      diff += renderSkippedSection(
        maxIndexDisplayed + 1,
        childrenKeys.length - 1,
      );
    }
  } else if (endMarker) {
    diff += setColor(endMarker, node.color);
  }
  return diff;
};
function* generateChildIndexes(
  childrenKeys,
  {
    startIndex,
    minIndex,
    maxIndex,
    // "pick_around_starting_before"
    // "pick_around_starting_after"
    // "all_before_then_all_after"
    // "all_after_then_all_before"
    childrenVisitMethod,
  },
) {
  yield startIndex;
  if (childrenVisitMethod === "all_before_then_all_after") {
    let beforeAttempt = 0;
    while (true) {
      const beforeChildIndex = startIndex - beforeAttempt - 1;
      if (beforeChildIndex === minIndex - 1) {
        break;
      }
      if (beforeChildIndex < 0) {
        break;
      }
      beforeAttempt++;
      yield beforeChildIndex;
    }
    let afterAttempt = 0;
    while (true) {
      const afterChildIndex = startIndex + afterAttempt + 1;
      if (afterChildIndex === maxIndex - 1) {
        break;
      }
      if (afterChildIndex >= childrenKeys.length) {
        break;
      }
      afterAttempt++;
      yield afterChildIndex;
    }
    return;
  }
  if (childrenVisitMethod === "all_after_then_all_before") {
    let afterAttempt = 0;
    while (true) {
      const afterChildIndex = startIndex + afterAttempt + 1;
      if (afterChildIndex === maxIndex - 1) {
        break;
      }
      if (afterChildIndex >= childrenKeys.length) {
        break;
      }
      afterAttempt++;
      yield afterChildIndex;
    }
    let beforeAttempt = 0;
    while (true) {
      const beforeChildIndex = startIndex - beforeAttempt - 1;
      if (beforeChildIndex === minIndex - 1) {
        break;
      }
      if (beforeChildIndex < 0) {
        break;
      }
      beforeAttempt++;
      yield beforeChildIndex;
    }
    return;
  }
  let previousAttempt = 0;
  let nextAttempt = 0;
  let tryBeforeFirst = childrenVisitMethod === "pick_around_starting_before";
  while (true) {
    const previousChildIndex = startIndex - previousAttempt - 1;
    const hasPreviousChild =
      previousChildIndex === minIndex - 1 ? false : previousChildIndex >= 0;
    const nextChildIndex = startIndex + nextAttempt + 1;
    const hasNextChild =
      nextChildIndex === maxIndex - 1
        ? false
        : nextChildIndex < childrenKeys.length;
    if (!hasPreviousChild && !hasNextChild) {
      break;
    }
    if (hasPreviousChild && hasNextChild) {
      if (tryBeforeFirst) {
        previousAttempt++;
        yield previousChildIndex;
        nextAttempt++;
        yield nextChildIndex;
      } else {
        nextAttempt++;
        yield nextChildIndex;
        previousAttempt++;
        yield previousChildIndex;
      }
    } else if (hasPreviousChild) {
      previousAttempt++;
      yield previousChildIndex;
      tryBeforeFirst = false;
    } else {
      nextAttempt++;
      yield nextChildIndex;
      tryBeforeFirst = childrenVisitMethod === "pick_around_starting_before";
    }
  }
}
const renderChildrenMultilineWhenDiff = (node, props) => {
  if (node.diffType === "solo") {
    return renderChildrenMultiline(node, props);
  }
  if (node.childComparisonDiffMap.size > 0) {
    return renderChildrenMultiline(node, props);
  }
  return renderChildren(node, props);
};
/*
Rewrite "renderChildrenMultiline" so that:
- We start to render from the first child with a diff
and we discover around
then if we need to skip we append skipp stuff

the goal is that for lines we will first render the first line with a diff
as this line will impose to the surrounding lines where the focus will be
*/
const renderChildrenMultiline = (node, props) => {
  const childrenKeys = node.childrenKeys;
  const {
    separatorBetweenEachChildDisabled = false,
    hasSeparatorOnSingleChild = true,
    hasTrailingSeparator,
    hasNewLineAroundChildren,
    hasIndentBeforeEachChild,
    hasIndentBetweenEachChild,
    hasMarkersWhenEmpty,
    maxDiffType = "prop",
  } = node.multilineDiff;
  const {
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF,
  } = props;
  const maxDiff =
    typeof MAX_DIFF_INSIDE_VALUE === "number"
      ? MAX_DIFF_INSIDE_VALUE
      : MAX_DIFF_INSIDE_VALUE[maxDiffType];
  const maxChildBeforeDiff =
    typeof MAX_CONTEXT_BEFORE_DIFF === "number"
      ? MAX_CONTEXT_BEFORE_DIFF
      : MAX_CONTEXT_BEFORE_DIFF[maxDiffType];
  const maxChildAfterDiff =
    typeof MAX_CONTEXT_AFTER_DIFF === "number"
      ? MAX_CONTEXT_AFTER_DIFF
      : MAX_CONTEXT_AFTER_DIFF[maxDiffType];

  let focusedChildIndex = 0;
  const childIndexToDisplayArray = [];
  index_to_display: {
    if (childrenKeys.length === 0) {
      break index_to_display;
    }
    if (maxDiff === Infinity) {
      let index = 0;
      // eslint-disable-next-line no-unused-vars
      for (const key of childrenKeys) {
        childIndexToDisplayArray.push(index);
        index++;
      }
      break index_to_display;
    }
    let diffCount = 0;
    const visitChild = (childIndex) => {
      const childKey = childrenKeys[childIndex];
      const childNode = node.childNodeMap.get(childKey);
      if (!childNode.comparison.hasAnyDiff) {
        return false;
      }
      if (
        childNode.subgroup === "property_entry" &&
        childNode.childNodeMap.get("entry_value").isSourceCode
      ) {
      } else {
        diffCount++;
      }
      return true;
    };
    if (node.firstChildWithDiffKey === undefined) {
      focusedChildIndex = 0;
    } else {
      focusedChildIndex = childrenKeys.indexOf(node.firstChildWithDiffKey);
    }
    let childIndex = focusedChildIndex;
    while (
      // eslint-disable-next-line no-unmodified-loop-condition
      diffCount < maxDiff
    ) {
      let currentChildHasDiff = visitChild(childIndex);
      if (currentChildHasDiff) {
        before: {
          const beforeDiffRemainingCount = maxChildBeforeDiff;
          if (beforeDiffRemainingCount < 1) {
            break before;
          }
          let fromIndex = childIndex - beforeDiffRemainingCount;
          let toIndex = childIndex;
          if (fromIndex < 0) {
            fromIndex = 0;
          } else {
            if (childIndexToDisplayArray.length) {
              const previousChildIndexToDisplay =
                childIndexToDisplayArray[childIndexToDisplayArray.length - 1];
              if (previousChildIndexToDisplay + 1 === fromIndex) {
                // prevent skip length of 1
                childIndexToDisplayArray.push(previousChildIndexToDisplay + 1);
              }
            }
            if (fromIndex > 0) {
              fromIndex++;
            }
          }
          let index = fromIndex;
          while (index !== toIndex) {
            if (childIndexToDisplayArray.includes(index)) {
              // already rendered
            } else {
              visitChild(index);
              childIndexToDisplayArray.push(index);
            }
            index++;
          }
        }
        childIndexToDisplayArray.push(childIndex);
        after: {
          const afterDiffRemainingCount = maxChildAfterDiff;
          if (afterDiffRemainingCount < 1) {
            break after;
          }
          let fromIndex = childIndex + 1;
          let toIndex = childIndex + 1 + afterDiffRemainingCount;
          if (toIndex > childrenKeys.length) {
            toIndex = childrenKeys.length;
          } else if (toIndex !== childrenKeys.length) {
            toIndex--;
          }

          let index = fromIndex;
          while (index !== toIndex) {
            if (childIndexToDisplayArray.includes(index)) {
              // already rendered
            } else {
              currentChildHasDiff = visitChild(index);
              childIndexToDisplayArray.push(index);
              childIndex = index;
            }
            index++;
          }
        }
      } else if (childIndex === focusedChildIndex) {
        childIndexToDisplayArray.push(focusedChildIndex);
      }
      if (childIndex === childrenKeys.length - 1) {
        break;
      }
      childIndex++;
      continue;
    }
  }
  if (node.beforeRender) {
    node.beforeRender(props, { focusedChildIndex, childIndexToDisplayArray });
  }
  const { startMarker, endMarker } = node;
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let childrenDiff = "";
  const renderedRange = { start: Infinity, end: -1 };
  let firstAppend = true;
  const appendChildDiff = (childDiff, childIndex) => {
    if (firstAppend) {
      firstAppend = false;
      renderedRange.start = renderedRange.end = childIndex;
      return childDiff;
    }
    if (childIndex < renderedRange.start) {
      renderedRange.start = childIndex;
      return `${childDiff}\n${childrenDiff}`;
    }
    renderedRange.end = childIndex;
    return `${childrenDiff}\n${childDiff}`;
  };
  const appendSkippedSection = (fromIndex, toIndex) => {
    const skippedMarkers = node.multilineDiff.skippedMarkers || {
      start: ["↑ 1 value ↑", "↑ {x} values ↑"],
      between: ["↕ 1 value ↕", "↕ {x} values ↕"],
      end: ["↓ 1 value ↓", "↓ {x} values ↓"],
    };
    const skippedCount = toIndex - fromIndex;
    let skippedChildIndex = fromIndex;
    let modifiedCount = 0;
    let soloCount = 0;
    let modifiedColor;
    let soloColor;
    while (skippedChildIndex !== toIndex) {
      skippedChildIndex++;
      const skippedChildKey = childrenKeys[skippedChildIndex];
      const skippedChild = node.childNodeMap.get(skippedChildKey);
      if (skippedChild.diffType === "modified") {
        modifiedCount++;
        modifiedColor = skippedChild.color;
      }
      if (skippedChild.diffType === "solo") {
        soloCount++;
        soloColor = skippedChild.color;
      }
    }
    const allModified = modifiedCount === skippedCount;
    const allSolo = soloCount === skippedCount;
    let skippedDiff = "";
    if (hasIndentBeforeEachChild) {
      skippedDiff += "  ".repeat(getNodeDepth(node, props) + 1);
    }
    let skippedMarker;
    if (fromIndex < renderedRange.start) {
      skippedMarker = skippedMarkers.start;
    } else {
      if (hasIndentBetweenEachChild) {
        skippedDiff += " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
      }
      if (toIndex < childrenKeys.length - 1) {
        skippedMarker = skippedMarkers.between;
      } else {
        skippedMarker = skippedMarkers.end;
      }
    }
    if (skippedCount === 1) {
      skippedDiff += setColor(
        skippedMarker[0],
        allModified ? modifiedColor : allSolo ? soloColor : node.color,
      );
    } else {
      skippedDiff += setColor(
        skippedMarker[1].replace("{x}", skippedCount),
        allModified ? modifiedColor : allSolo ? soloColor : node.color,
      );
    }
    const details = [];
    if (modifiedCount && modifiedCount !== skippedCount) {
      details.push(setColor(`${modifiedCount} modified`, modifiedColor));
    }
    if (soloCount && soloCount !== skippedCount) {
      details.push(
        node.name === "actual"
          ? setColor(`${soloCount} added`, soloColor)
          : setColor(`${soloCount} removed`, soloColor),
      );
    }
    if (details.length) {
      skippedDiff += " ";
      skippedDiff += setColor(`(`, node.color);
      skippedDiff += details.join(", ");
      skippedDiff += setColor(`)`, node.color);
    }
    childrenDiff = appendChildDiff(
      skippedDiff,
      toIndex === childrenKeys.length - 1 ? toIndex : fromIndex,
    );
  };
  const renderChildDiff = (childNode, childIndex) => {
    let childDiff = "";
    let columnsRemainingForThisChild =
      childIndex > 0 || hasNewLineAroundChildren
        ? props.MAX_COLUMNS
        : props.columnsRemaining;
    if (hasIndentBeforeEachChild) {
      const indent = "  ".repeat(getNodeDepth(node, props) + 1);
      columnsRemainingForThisChild -= indent.length;
      childDiff += indent;
    }
    if (hasIndentBetweenEachChild && childIndex !== 0) {
      const indent = " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
      columnsRemainingForThisChild -= indent.length;
      childDiff += indent;
    }

    let {
      separatorMarker,
      separatorMarkerWhenTruncated,
      separatorMarkerDisabled,
    } = childNode;
    if (separatorMarkerDisabled) {
    } else if (
      separatorBetweenEachChildDisabled ||
      shouldDisableSeparator(childIndex, childrenKeys, {
        hasTrailingSeparator,
        hasSeparatorOnSingleChild,
      })
    ) {
      separatorMarkerDisabled = true;
      if (childNode.subgroup === "property_entry") {
        const propertyValueNode = childNode.childNodeMap.get("entry_value");
        propertyValueNode.separatorMarkerDisabled = true;
      }
    } else if (childNode.subgroup === "property_entry") {
      if (childNode.onelineDiff) {
        childNode.onelineDiff.hasSeparatorOnSingleChild = true;
      }
    }
    if (separatorMarkerWhenTruncated === undefined) {
      columnsRemainingForThisChild -= separatorMarker.length;
    } else {
      columnsRemainingForThisChild -= separatorMarkerWhenTruncated.length;
    }
    if (childNode.subgroup === "line_entry_value") {
      if (childIndex === focusedChildIndex) {
        childDiff += childNode.render({
          ...props,
          columnsRemaining: columnsRemainingForThisChild,
        });
      } else {
        childNode.rangeToDisplay = focusedChildNode.displayedRange;
        childDiff += childNode.render({
          ...props,
          columnsRemaining: columnsRemainingForThisChild,
        });
      }
    } else {
      childDiff += childNode.render({
        ...props,
        columnsRemaining: columnsRemainingForThisChild,
      });
    }
    let separatorMarkerToAppend;
    if (separatorMarkerWhenTruncated === undefined) {
      separatorMarkerToAppend = separatorMarker;
    } else {
      const remainingColumns =
        columnsRemainingForThisChild - stringWidth(childDiff);
      if (remainingColumns > separatorMarker.length + 1) {
        separatorMarkerToAppend = separatorMarkerDisabled
          ? ""
          : separatorMarker;
      } else {
        separatorMarkerToAppend = separatorMarkerWhenTruncated;
      }
    }
    if (separatorMarkerToAppend) {
      if (childNode.diffType === "solo") {
        childDiff += setColor(separatorMarkerToAppend, childNode.color);
      } else {
        childDiff += setColor(separatorMarkerToAppend, node.color);
      }
    }
    return childDiff;
  };
  const focusedChildKey = childrenKeys[focusedChildIndex];
  const focusedChildNode = node.childNodeMap.get(focusedChildKey);
  const focusedChildDiff = renderChildDiff(focusedChildNode, focusedChildIndex);
  const [firstChildIndexToDisplay] = childIndexToDisplayArray;
  if (firstChildIndexToDisplay > 0) {
    appendSkippedSection(0, firstChildIndexToDisplay);
  }
  let previousChildIndexDisplayed;
  for (const childIndexToDisplay of childIndexToDisplayArray) {
    if (
      previousChildIndexDisplayed !== undefined &&
      childIndexToDisplay !== previousChildIndexDisplayed + 1
    ) {
      appendSkippedSection(
        previousChildIndexDisplayed,
        childIndexToDisplay - 1,
      );
    }
    if (childIndexToDisplay === focusedChildIndex) {
      childrenDiff = appendChildDiff(focusedChildDiff, childIndexToDisplay);
    } else {
      const childKey = childrenKeys[childIndexToDisplay];
      const childNode = node.childNodeMap.get(childKey);
      const childDiff = renderChildDiff(childNode, childIndexToDisplay);
      childrenDiff = appendChildDiff(childDiff, childIndexToDisplay);
    }
    previousChildIndexDisplayed = childIndexToDisplay;
  }
  if (
    childrenKeys.length > 1 &&
    previousChildIndexDisplayed !== childrenKeys.length - 1
  ) {
    appendSkippedSection(previousChildIndexDisplayed, childrenKeys.length - 1);
  }
  let diff = "";
  diff += setColor(startMarker, node.color);
  if (hasNewLineAroundChildren) {
    diff += "\n";
  }
  diff += childrenDiff;
  if (hasNewLineAroundChildren) {
    diff += "\n";
    diff += "  ".repeat(getNodeDepth(node, props));
  }
  diff += setColor(endMarker, node.color);
  return diff;
};

const getNodeDepth = (node, props) => {
  return node.depth - props.startNode.depth;
};
const enableMultilineDiff = (lineEntriesNode) => {
  lineEntriesNode.multilineDiff.hasIndentBetweenEachChild =
    !lineEntriesNode.multilineDiff.lineNumbersDisabled;
  lineEntriesNode.beforeRender = (props, { childIndexToDisplayArray }) => {
    if (props.forceDisableSeparatorMarker) {
      props.columnsRemaining += props.separatorMarker.length;
      props.forceDisableSeparatorMarker();
    }
    const biggestDisplayedLineIndex =
      childIndexToDisplayArray[childIndexToDisplayArray.length - 1];
    for (const lineIndexToDisplay of childIndexToDisplayArray) {
      const lineNode = lineEntriesNode.childNodeMap.get(lineIndexToDisplay);
      lineNode.onelineDiff.hasMarkersWhenEmpty = true;
      if (!lineEntriesNode.multilineDiff.lineNumbersDisabled) {
        lineNode.startMarker = renderLineStartMarker(
          lineNode,
          biggestDisplayedLineIndex,
        );
      }
    }
  };
  const firstLineNode = lineEntriesNode.childNodeMap.get(0);
  firstLineNode.onelineDiff.hasMarkersWhenEmpty = false;
  firstLineNode.onelineDiff.skippedMarkersPlacement = "inside";
  firstLineNode.startMarker = firstLineNode.endMarker = "";
};
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
const renderLineStartMarker = (lineNode, biggestDisplayedLineIndex) => {
  const lineNumberString = String(lineNode.key + 1);
  const biggestDisplayedLineNumberString = String(
    biggestDisplayedLineIndex + 1,
  );
  if (biggestDisplayedLineNumberString.length > lineNumberString.length) {
    return ` ${lineNumberString}| `;
  }
  return `${lineNumberString}| `;
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
        value: objectName,
        render: renderGrammar,
        group: "grammar",
        subgroup: "object_name",
      });
      if (methodName) {
        methodCallNode.appendChild("method_dot", {
          value: ".",
          render: renderGrammar,
          group: "grammar",
          subgroup: "method_dot",
        });
        methodCallNode.appendChild("method_name", {
          value: methodName,
          render: renderGrammar,
          group: "grammar",
          subgroup: "method_name",
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
          value: argValue,
          render: renderValue,
          separatorMarker: ",",
          group: "entry_value",
          subgroup: "arg_entry_value",
          path: node.path.append(key || argIndex),
          depth: node.depth,
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

const getAddedOrRemovedReason = (node) => {
  if (node.group === "url_internal_prop") {
    return node.subgroup;
  }
  if (node.category === "entry") {
    return getAddedOrRemovedReason(node.childNodeMap.get("entry_key"));
  }
  if (node.category === "entry_key") {
    return node.value;
  }
  if (node.category === "entry_value") {
    return getAddedOrRemovedReason(node.parent);
  }
  if (node.subgroup === "value_of_return_value") {
    return "value_of_own_method";
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
  if (ownPropertyName === "length") {
    return node.isArray || node.isFunction;
  }
  if (ownPropertyName === "name") {
    return node.isFunction;
  }
  if (ownPropertyName === "stack") {
    return node.isError;
  }
  return false;
};
const shouldIgnoreOwnPropertySymbol = (node, ownPropertySymbol) => {
  if (ownPropertySymbol === Symbol.toPrimitive) {
    if (
      node.childNodes.wrappedValue &&
      node.childNodes.wrappedValue.key === "Symbol.toPrimitive()"
    ) {
      return true;
    }
    return false;
  }
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
  if (node.isPromise) {
    if (
      !Symbol.keyFor(ownPropertySymbol) &&
      symbolToDescription(ownPropertySymbol) === "async_id_symbol"
    ) {
      // nodejs runtime puts a custom Symbol on promise
      return true;
    }
    return false;
  }
  if (node.isHeaders) {
    if (
      !Symbol.keyFor(ownPropertySymbol) &&
      ["guard", "headers list"].includes(symbolToDescription(ownPropertySymbol))
    ) {
      // nodejs runtime put custom symbols on Headers
      return true;
    }
    return false;
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

// prettier-ignore
const CHAR_TO_ESCAPED_CHAR = [
  '\\x00', '\\x01', '\\x02', '\\x03', '\\x04', '\\x05', '\\x06', '\\x07', // x07
  '\\b', '\\t', '\\n', '\\x0B', '\\f', '\\r', '\\x0E', '\\x0F',           // x0F
  '\\x10', '\\x11', '\\x12', '\\x13', '\\x14', '\\x15', '\\x16', '\\x17', // x17
  '\\x18', '\\x19', '\\x1A', '\\x1B', '\\x1C', '\\x1D', '\\x1E', '\\x1F', // x1F
  '', '', '', '', '', '', '', "\\'", '', '', '', '', '', '', '', '',      // x2F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x3F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x4F
  '', '', '', '', '', '', '', '', '', '', '', '', '\\\\', '', '', '',     // x5F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x6F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '\\x7F',    // x7F
  '\\x80', '\\x81', '\\x82', '\\x83', '\\x84', '\\x85', '\\x86', '\\x87', // x87
  '\\x88', '\\x89', '\\x8A', '\\x8B', '\\x8C', '\\x8D', '\\x8E', '\\x8F', // x8F
  '\\x90', '\\x91', '\\x92', '\\x93', '\\x94', '\\x95', '\\x96', '\\x97', // x97
  '\\x98', '\\x99', '\\x9A', '\\x9B', '\\x9C', '\\x9D', '\\x9E', '\\x9F', // x9F
];

const shouldDisableSeparator = (
  childIndex,
  childrenKeys,
  { hasSeparatorOnSingleChild, hasTrailingSeparator },
) => {
  if (childrenKeys.length === 1) {
    return !hasSeparatorOnSingleChild;
  }
  if (childIndex === childrenKeys.length - 1) {
    return !hasTrailingSeparator;
  }
  return false;
};

const canParseUrl =
  URL.canParse ||
  (() => {
    try {
      // eslint-disable-next-line no-new, no-undef
      new URL(url);
      return true;
    } catch (e) {
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
