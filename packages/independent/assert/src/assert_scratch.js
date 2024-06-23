/*
 * LE PLUS DUR QU'IL FAUT FAIRE AVANT TOUT:
 *
 * - make multiline use an approach similar to one line (prev/next iterative)
 * - make one line use an approach similar to multiline for skipped part
 *   (not just a marker appended, it's a "fake" child with spaces and so on)
 * - attempt to force a range on surrounding lines
 *   when the first line with a diff is rendered
 *   (prepare for implementing next part where multiline diff
 *   impact surrounding lines rendering)
 * - test for diff in the middle of multiline
 * - fix max columns for double slash truncated
 *   it does not work as expected (is related to urls because when regular string it works)
 * - lots of test on max columns
 * - array typed
 * - property descriptors
 * - errors
 * - prototype
 * - more wrapped value tests (from internal_value.xtest.js)
 * - numbers
 * - quote in
 *    - property name
 *    - url search param name
 *    - url search param value
 *    - url pathname
 *    - ensure backtick cannot be used for object property key
 *  - date
 *  - object integrity
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
import { tokenizeString } from "./tokenize_string.js";
import { tokenizeUrlSearch } from "./tokenize_url_search.js";
import { getWellKnownValuePath } from "./well_known_value.js";

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
const updateRemainingColumns = (columnsRemaining, string) => {
  const newLineLastIndex = string.lastIndexOf("\n");
  if (newLineLastIndex === -1) {
    return columnsRemaining - stringWidth(string);
  }
  const lastLine = string.slice(newLineLastIndex + "\n".length);
  return stringWidth(lastLine);
};
const measureRemainingColumnsImpact = (string) => {
  const newLineLastIndex = string.lastIndexOf("\n");
  if (newLineLastIndex === -1) {
    return stringWidth(string);
  }
  const lastLine = string.slice(newLineLastIndex + "\n".length);
  return stringWidth(lastLine);
};

const defaultOptions = {
  actual: undefined,
  expect: undefined,
  MAX_ENTRY_BEFORE_MULTILINE_DIFF: 2,
  MAX_ENTRY_AFTER_MULTILINE_DIFF: 2,
  MAX_DEPTH: 5,
  MAX_DEPTH_INSIDE_DIFF: 1,
  MAX_DIFF_PER_OBJECT: 2,
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
    MAX_ENTRY_BEFORE_MULTILINE_DIFF,
    MAX_ENTRY_AFTER_MULTILINE_DIFF,
    MAX_DEPTH,
    MAX_DEPTH_INSIDE_DIFF,
    MAX_DIFF_PER_OBJECT,
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
      const { result, reason, propagate } = expectNode.comparer(
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
    };
    const visitSolo = (node, placeholderNode) => {
      if (node.comparison) {
        throw new Error(`node (${node.subgroup}) already compared`);
      }
      node.comparison = comparison;
      subcompareChildrenSolo(node, placeholderNode);
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
    MAX_ENTRY_BEFORE_MULTILINE_DIFF,
    MAX_ENTRY_AFTER_MULTILINE_DIFF,
    MAX_DEPTH,
    MAX_DEPTH_INSIDE_DIFF,
    MAX_DIFF_PER_OBJECT,
    MAX_COLUMNS,
    columnsRemaining: MAX_COLUMNS - "actual: ".length,
    startNode: actualStartNode,
  });
  diff += `\n`;
  diff += ANSI.color("expect:", sameColor);
  diff += " ";
  diff += expectStartNode.render({
    MAX_ENTRY_BEFORE_MULTILINE_DIFF,
    MAX_ENTRY_AFTER_MULTILINE_DIFF,
    MAX_DEPTH,
    MAX_DEPTH_INSIDE_DIFF,
    MAX_DIFF_PER_OBJECT,
    MAX_COLUMNS,
    columnsRemaining: MAX_COLUMNS - "expect: ".length,
    startNode: expectStartNode,
  });
  throw diff;
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
    comparer = comparerDefault,
    isSourceCode = false,
    isFunctionPrototype = false,
    isClassPrototype = false,
    customCompare,
    render,
    isHidden = false,
    isHiddenWhenSame = false,
    focusedChildIndex,
    startMarker = "",
    endMarker = "",
    quoteMarkerRef,
    separatorMarkerRef,
    separatorMarkerWhenTruncatedRef,
    separatorMarkerOwner = separatorMarkerRef
      ? parent
      : parent?.separatorMarkerOwner,
    separatorMarkerInsideRef,
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
      comparer,
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
      isSymbol: false,
      // info/composite
      isFunction: false,
      functionAnalysis: defaultFunctionAnalysis,
      isArray: false,
      isMap: false,
      isSet: false,
      isURL: false,
      referenceFromOthersSet: referenceFromOthersSetDefault,
      // render info
      render: (props) => render(node, props),
      isHidden,
      isHiddenWhenSame,
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
      indexToDisplayArray: null,
      diffType: "",
      otherNode: null,
      // END will be set by comparison
      startMarker,
      endMarker,
      quoteMarkerRef,
      separatorMarkerRef,
      separatorMarkerWhenTruncatedRef,
      separatorMarkerOwner,
      separatorMarkerInsideRef,
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
      if (group === "url_internal_prop") {
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
        let canUseBacktick = false;
        if (subgroup === "property_entry_key") {
          if (isValidPropertyIdentifier(value)) {
            // no quote around valid property identifier
            break best_quote;
          }
        } else {
          canUseBacktick = true;
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
          if (canUseBacktick && backtickCount === 0) {
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

      if (canParseUrl(value)) {
        node.isStringForUrl = true;
        node.childGenerator = () => {
          const urlObject = new URL(value);
          const urlInternalPropertiesNode = node.appendChild(
            "url_internal_properties",
            {
              render: renderChildren,
              onelineDiff: {
                hasSeparatorBetweenEachChild: true,
                hasTrailingSeparator: true,
                skippedMarkers: {
                  start: "…",
                  middle: "…",
                  end: "…",
                },
              },
              startMarker: bestQuote,
              endMarker: bestQuote,
              quoteMarkerRef,
              separatorMarkerRef: node.separatorMarkerRef,
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
                        hasSeparatorBetweenEachChild: true,
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
                                hasSeparatorBetweenEachChild: true,
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
                                        hasSeparatorBetweenEachChild: true,
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
                                    separatorMarkerRef: { current: "=" },
                                    separatorMarkerWhenTruncatedRef: {
                                      current: "",
                                    },
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
          // because the string might differ but
          // after comparing all url props it's still the same url
          // under the hood (see spaces in search params)
          urlInternalPropertiesNode.separatorMarkerOwner =
            urlInternalPropertiesNode;
        };
        return node;
      }
      node.childGenerator = () => {
        const lineEntriesNode = node.appendChild("line_entries", {
          render: renderChildrenMultiline,
          multilineDiff: {
            hasSeparatorBetweenEachChild: true,
            hasTrailingSeparator: true,
            skippedMarkers: {
              start: ["↑ 1 line ↑", "↑ {x} lines ↑"],
              middle: ["↕ 1 line ↕", "↕ {x} lines ↕"],
              end: ["↓ 1 line ↓", "↓ {x} lines ↓"],
            },
            maxDiff: 1,
          },
          quoteMarkerRef,
          group: "entries",
          subgroup: "line_entries",
          childGenerator: () => {
            let isMultiline = false;
            const appendLineEntry = (lineIndex) => {
              const lineEntryNode = lineEntriesNode.appendChild(lineIndex, {
                value: "",
                key: lineIndex,
                render: renderChildren,
                onelineDiff: {
                  hasSeparatorBetweenEachChild: true,
                  focusedChildWhenSame: "last",
                  skippedMarkers: {
                    start: "…",
                    middle: "…",
                    end: "…",
                  },
                  skippedMarkersPlacement: isMultiline ? "inside" : "outside",
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
              const appendCharEntry = (charIndex, char) => {
                lineEntryNode.value += char; // just for debug purposes
                lineEntryNode.appendChild(charIndex, {
                  value: char,
                  render: renderChar,
                  quoteMarkerRef,
                  group: "entry_value",
                  subgroup: "char_entry_value",
                });
              };
              return {
                lineEntryNode,
                appendCharEntry,
              };
            };

            let isDone = false;
            let firstLineCharIndex = 0;
            const chars = tokenizeString(node.value);
            const charIterator = chars[Symbol.iterator]();
            function* charGeneratorUntilNewLine() {
              // eslint-disable-next-line no-constant-condition
              while (true) {
                const charIteratorResult = charIterator.next();
                if (charIteratorResult.done) {
                  isDone = true;
                  return;
                }
                const char = charIteratorResult.value;
                if (char === "\n") {
                  break;
                }
                yield char;
              }
            }

            // first line
            const {
              lineEntryNode: firstLineEntryNode,
              appendCharEntry: appendFirstLineCharEntry,
            } = appendLineEntry(0);
            for (const char of charGeneratorUntilNewLine()) {
              appendFirstLineCharEntry(firstLineCharIndex, char);
              firstLineCharIndex++;
            }

            if (isDone) {
              // single line
              Object.assign(
                firstLineEntryNode,
                getInheritedSeparatorParams(node),
              );
              if (bestQuote) {
                firstLineEntryNode.onelineDiff.hasMarkersWhenEmpty = true;
                firstLineEntryNode.startMarker = firstLineEntryNode.endMarker =
                  bestQuote;
              }
              return;
            }
            isMultiline = true;
            enableMultilineDiff(lineEntriesNode);
            // remaining lines
            let lineIndex = 1;
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const { appendCharEntry } = appendLineEntry(lineIndex);
              let columnIndex = 0;
              for (const char of charGeneratorUntilNewLine()) {
                appendCharEntry(columnIndex, char);
                columnIndex++;
              }
              if (isDone) {
                break;
              }
              lineIndex++;
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
              hasSeparatorBetweenEachChild: true,
              hasTrailingSeparator: true,
            },
            ...getInheritedSeparatorParams(node),
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
      }
      node.childGenerator = function () {
        if (node.reference) {
          const referenceNode = node.appendChild("reference", {
            value: node.reference.path,
            render: renderChildren,
            onelineDiff: {
              hasSeparatorBetweenEachChild: true,
              hasTrailingSeparator: true,
            },
            separatorMarkerRef: node.separatorMarkerRef,
            separatorMarkerOwner:
              node.reference.separatorMarkerOwner || node.reference,
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
              hasSeparatorBetweenEachChild: true,
              hasTrailingSeparator: true,
            },
            ...getInheritedSeparatorParams(node),
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
        let objectConstructNode = null;
        let objectConstructArgs = null;
        // function child nodes
        if (node.isFunction) {
          const functionConstructNode = node.appendChild("construct", {
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
                  functionConstructNode.appendChild("class_extends_keyword", {
                    value: "extends",
                    render: renderGrammar,
                    group: "grammar",
                    subgroup: "class_extends_keyword",
                  });
                  functionConstructNode.appendChild("class_extended_name", {
                    value: extendedClassName,
                    render: renderGrammar,
                    group: "grammar",
                    subgroup: "class_extended_name",
                  });
                }
                return;
              }
              if (node.functionAnalysis.isAsync) {
                functionConstructNode.appendChild("function_async_keyword", {
                  value: "async",
                  render: renderGrammar,
                  group: "grammar",
                  subgroup: "function_async_keyword",
                });
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
                  functionConstructNode.appendChild("function_body_prefix", {
                    value: prefix,
                    render: renderGrammar,
                    group: "grammar",
                    subgroup: "function_body_prefix",
                  });
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
          });
        } else if (isFunctionPrototype) {
        } else {
          const objectTag = getObjectTag(value);
          if (objectTag && objectTag !== "Object" && objectTag !== "Array") {
            objectConstructNode = node.appendChild("construct", {
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
            });
          }
        }
        let canHaveInternalEntries = false;
        internal_entries: {
          const internalEntriesParams = {
            render: renderChildrenMaybeMultiline,
            startMarker: "(",
            endMarker: ")",
            onelineDiff: {
              hasMarkersWhenEmpty: true,
              hasSeparatorBetweenEachChild: true,
              hasSpacingBetweenEachChild: true,
            },
            multilineDiff: {
              hasMarkersWhenEmpty: true,
              hasSeparatorBetweenEachChild: true,
              hasTrailingSeparator: true,
              hasNewLineAroundChildren: true,
              hasIndentBeforeEachChild: true,
              skippedMarkers: {
                start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                middle: ["↕ 1 value ↕", "↕ {x} values ↕"],
                end: ["↓ 1 value ↓", "↓ {x} values ↓"],
              },
              maxDiff: "MAX_DIFF_PER_OBJECT",
            },
            group: "entries",
          };

          if (node.isMap) {
            canHaveInternalEntries = true;
            const mapEntriesNode = node.appendChild("internal_entries", {
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
                      objectTagCounterMap.set(keyObjectTag, objectTagCount);
                      pathPart = `${keyObjectTag}#${objectTagCount}`;
                    } else {
                      objectTagCounterMap.set(keyObjectTag, 1);
                      pathPart = `${keyObjectTag}#1`;
                    }
                  } else {
                    pathPart = String(mapEntryKey);
                  }

                  const mapEntryNode = mapEntriesNode.appendChild(mapEntryKey, {
                    render: renderChildren,
                    onelineDiff: {
                      hasSeparatorBetweenEachChild: true,
                      hasTrailingSeparator: true,
                    },
                    group: "entry",
                    subgroup: "map_entry",
                    path: node.path.append(pathPart),
                  });
                  mapEntryNode.appendChild("entry_key", {
                    value: mapEntryKey,
                    render: renderValue,
                    separatorMarkerRef: { current: " => " },
                    group: "entry_key",
                    subgroup: "map_entry_key",
                  });
                  mapEntryNode.appendChild("entry_value", {
                    value: mapEntryValue,
                    render: renderValue,
                    separatorMarkerRef: { current: "," },
                    group: "entry_value",
                    subgroup: "map_entry_value",
                  });
                }
                objectTagCounterMap.clear();
              },
            });
          }
          if (node.isSet) {
            canHaveInternalEntries = true;
            const setEntriesNode = node.appendChild("internal_entries", {
              ...internalEntriesParams,
              subgroup: "set_entries",
              childGenerator: () => {
                let index = 0;
                for (const [setValue] of value) {
                  setEntriesNode.appendChild(index, {
                    value: setValue,
                    render: renderValue,
                    separatorMarkerRef: { current: "," },
                    group: "entry_value",
                    subgroup: "set_entry",
                    path: setEntriesNode.path.append(index, {
                      isIndexedEntry: true,
                    }),
                  });
                  index++;
                }
              },
            });
          }
        }
        const ownPropertyNameToIgnoreSet = new Set();
        const ownPropertSymbolToIgnoreSet = new Set();
        let canHaveIndexedEntries = false;
        indexed_entries: {
          if (node.isArray) {
            canHaveIndexedEntries = true;
            const arrayEntriesNode = node.appendChild("indexed_entries", {
              render: renderChildrenMaybeMultiline,
              startMarker: "[",
              endMarker: "]",
              ...getInheritedSeparatorParams(node),
              onelineDiff: {
                hasMarkersWhenEmpty: true,
                hasSeparatorBetweenEachChild: true,
                hasTrailingSeparator: true,
                hasSpacingBetweenEachChild: true,
              },
              multilineDiff: {
                hasMarkersWhenEmpty: true,
                hasSeparatorBetweenEachChild: true,
                hasTrailingSeparator: true,
                hasNewLineAroundChildren: true,
                hasIndentBeforeEachChild: true,
                skippedMarkers: {
                  start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                  middle: ["↕ 1 value ↕", "↕ {x} values ↕"],
                  end: ["↓ 1 value ↓", "↓ {x} values ↓"],
                },
                maxDiff: "MAX_DIFF_PER_OBJECT",
              },
              group: "entries",
              subgroup: "array_entries",
            });
            const arrayEntyGenerator = () => {
              let index = 0;
              while (index < value.length) {
                ownPropertyNameToIgnoreSet.add(String(index));
                arrayEntriesNode.appendChild(index, {
                  value: Object.hasOwn(value, index)
                    ? value[index]
                    : ARRAY_EMPTY_VALUE,
                  render: renderValue,
                  separatorMarkerRef: { current: "," },
                  group: "entry_value",
                  subgroup: "array_entry_value",
                  path: arrayEntriesNode.path.append(index, {
                    isIndexedEntry: true,
                  }),
                });
                index++;
              }
            };
            arrayEntyGenerator();
          }
        }
        const propertyLikeCallbackSet = new Set();
        symbol_to_primitive: {
          if (
            Symbol.toPrimitive in value &&
            typeof value[Symbol.toPrimitive] === "function"
          ) {
            ownPropertSymbolToIgnoreSet.add(Symbol.toPrimitive);
            const toPrimitiveReturnValue = value[Symbol.toPrimitive]("string");
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
          const ownPropertySymbols = Object.getOwnPropertySymbols(value).filter(
            (ownPropertySymbol) => {
              return (
                !ownPropertSymbolToIgnoreSet.has(ownPropertySymbol) &&
                !shouldIgnoreOwnPropertySymbol(node, ownPropertySymbol)
              );
            },
          );
          const ownPropertyNames = Object.getOwnPropertyNames(value).filter(
            (ownPropertyName) => {
              return (
                !ownPropertyNameToIgnoreSet.has(ownPropertyName) &&
                !shouldIgnoreOwnPropertyName(node, ownPropertyName)
              );
            },
          );
          const skipOwnProperties =
            canHaveIndexedEntries &&
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
          const ownPropertiesNode = node.appendChild("own_properties", {
            render: renderChildrenMaybeMultiline,
            group: "entries",
            subgroup: "own_properties",
            ...(node.isClassPrototype
              ? {
                  onelineDiff: { hasMarkersWhenEmpty },
                  multilineDiff: { hasMarkersWhenEmpty },
                }
              : {
                  startMarker: "{",
                  endMarker: "}",
                  onelineDiff: {
                    hasMarkersWhenEmpty,
                    hasSeparatorBetweenEachChild: true,
                    hasSpacingAroundChildren: true,
                    hasSpacingBetweenEachChild: true,
                  },
                  multilineDiff: {
                    hasMarkersWhenEmpty,
                    hasSeparatorBetweenEachChild: true,
                    hasTrailingSeparator: true,
                    hasNewLineAroundChildren: true,
                    hasIndentBeforeEachChild: true,
                    skippedMarkers: {
                      start: ["↑ 1 prop ↑", "↑ {x} props ↑"],
                      middle: ["↕ 1 prop ↕", "↕ {x} props ↕"],
                      end: ["↓ 1 prop ↓", "↓ {x} props ↓"],
                    },
                    maxDiff: "MAX_DIFF_PER_OBJECT",
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
                const valueSeparatorMarkerRef = {
                  current: node.functionAnalysis.type === "class" ? ";" : ",",
                };
                const ownPropertyNode = ownPropertiesNode.appendChild(key, {
                  render: renderChildren,
                  onelineDiff: {
                    hasSeparatorBetweenEachChild: true,
                    hasTrailingSeparator: true,
                  },
                  focusedChildIndex: 0,
                  separatorMarkerInsideRef: valueSeparatorMarkerRef,
                  isFunctionPrototype,
                  isClassPrototype,
                  isHiddenWhenSame,
                  childGenerator: () => {
                    const valueFunctionAnalysis = tokenizeFunction(value);
                    if (
                      node.functionAnalysis.type === "class" &&
                      !isClassPrototype
                    ) {
                      ownPropertyNode.appendChild("static_keyword", {
                        render: renderGrammar,
                        separatorMarkerRef: { current: " " },
                        group: "grammar",
                        subgroup: "static_keyword",
                        value: "static",
                        isHidden:
                          isSourceCode ||
                          valueFunctionAnalysis.type === "method",
                      });
                    }
                    ownPropertyNode.appendChild("entry_key", {
                      render: renderPrimitive,
                      separatorMarkerRef: {
                        current: node.isClassPrototype
                          ? ""
                          : node.functionAnalysis.type === "class"
                            ? " = "
                            : ": ",
                      },
                      separatorMarkerWhenTruncatedRef: {
                        current: node.isClassPrototype
                          ? ""
                          : node.functionAnalysis.type === "class"
                            ? ";"
                            : ",",
                      },
                      separatorMarkerInsideRef,
                      group: "entry_key",
                      subgroup: "property_entry_key",
                      value: key,
                      isHidden:
                        isSourceCode ||
                        valueFunctionAnalysis.type === "method" ||
                        isClassPrototype,
                    });
                    ownPropertyNode.appendChild("entry_value", {
                      key,
                      value,
                      render: renderValue,
                      separatorMarkerRef: valueSeparatorMarkerRef,
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
                });
                return ownPropertyNode;
              };

              if (node.isFunction) {
                appendPropertyEntryNode(SOURCE_CODE_ENTRY_KEY, {
                  value: node.functionAnalysis.argsAndBodySource,
                  isSourceCode: true,
                });
              }
              for (const ownPropertySymbol of ownPropertySymbols) {
                const ownPropertySymbolValue = node.value[ownPropertySymbol];
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
          });
        }
      };
      node.wrappedNodeGetter = () => {
        const constructNode = node.childNodeMap.get("construct");
        if (constructNode) {
          const constructCallNode = constructNode.childNodeMap.get("call");
          if (constructCallNode) {
            const argEntriesNode = constructCallNode.childNodeMap.get("args");
            const firstArgNode = argEntriesNode.childNodeMap.get(0);
            return firstArgNode;
          }
        }
        const ownPropertiesNode = node.childNodeMap.get("own_properties");
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

  const comparerDefault = (actualNode, expectNode) => {
    if (actualNode.category === "primitive") {
      if (actualNode.value === expectNode.value) {
        return {
          result: "success",
          propagate: PLACEHOLDER_FOR_SAME,
        };
      }
      return {
        result: "failure",
        reason: "primitive_value",
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
// const renderInteger = (node, props) => {
//   let diff = JSON.stringify(node.value);
//   return truncateAndAppyColor(diff, node, props);
// };
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
    return setColor("…", node.color);
  }
  let columnsRemainingForValue = columnsRemaining;
  const { startMarker, endMarker, separatorMarkerRef } = node;
  let separatorMarker = separatorMarkerRef ? separatorMarkerRef.current : "";
  if (startMarker) {
    columnsRemainingForValue -= startMarker.length;
  }
  if (endMarker) {
    columnsRemainingForValue -= endMarker.length;
  }
  if (separatorMarker) {
    columnsRemainingForValue -= separatorMarker.length;
  }
  if (columnsRemainingForValue < 1) {
    return setColor("…", node.color);
  }
  let truncated = false;
  if (valueDiff.length > columnsRemainingForValue) {
    truncated = true;
    const { separatorMarkerWhenTruncatedRef } = node;
    if (separatorMarkerWhenTruncatedRef) {
      const separatorMarkerWhenTruncated =
        separatorMarkerWhenTruncatedRef.current;
      columnsRemainingForValue +=
        separatorMarker.length - separatorMarkerWhenTruncated.length;
      separatorMarker = separatorMarkerWhenTruncated;
    }
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
  if (separatorMarker) {
    diff += renderSeparatorMarker(node, props, { truncated });
  }
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
  const constructNode = node.childNodeMap.get("construct");
  const internalEntriesNode = node.childNodeMap.get("internal_entries");
  const indexedEntriesNode = node.childNodeMap.get("indexed_entries");
  const ownPropertiesNode = node.childNodeMap.get("own_properties");
  const childProps = {
    ...props,
  };
  if (maxDepthReached) {
    node.startMarker = node.endMarker = "";
    // const { separatorMarkerRef } = node;
    // if (separatorMarkerRef) {
    //   separatorMarkerRef.current = "";
    // }
    if (indexedEntriesNode) {
      const arrayLength = indexedEntriesNode.childNodeMap.size;
      return truncateAndApplyColor(`Array(${arrayLength})`, node, props);
    }
    const ownPropertyCount = ownPropertiesNode.childNodeMap.size;
    return truncateAndApplyColor(`Object(${ownPropertyCount})`, node, props);
  }
  let columnsRemaining = props.columnsRemaining;
  const { separatorMarkerRef } = node;
  const separatorMarker = separatorMarkerRef ? separatorMarkerRef.current : "";
  if (separatorMarker) {
    columnsRemaining -= separatorMarker.length;
  }
  if (constructNode) {
    const constructDiff = constructNode.render(childProps);
    columnsRemaining = updateRemainingColumns(columnsRemaining, constructDiff);
    diff += constructDiff;
  }
  if (internalEntriesNode) {
    const internalEntriesDiff = internalEntriesNode.render({
      ...childProps,
      columnsRemaining,
    });
    columnsRemaining = updateRemainingColumns(
      columnsRemaining,
      internalEntriesDiff,
    );
    diff += internalEntriesDiff;
  }
  if (indexedEntriesNode) {
    if (diff) {
      columnsRemaining -= " ".length;
      diff += " ";
    }
    const indexedEntriesDiff = indexedEntriesNode.render({
      ...childProps,
      columnsRemaining,
    });
    columnsRemaining = updateRemainingColumns(
      columnsRemaining,
      indexedEntriesDiff,
    );
    diff += indexedEntriesDiff;
  }
  if (ownPropertiesNode) {
    const ownPropertiesDiff = ownPropertiesNode.render({
      ...childProps,
      columnsRemaining,
    });
    if (ownPropertiesDiff) {
      if (diff) {
        columnsRemaining -= " ".length;
        diff += " ";
      }
      diff += ownPropertiesDiff;
    }
  }
  if (separatorMarker) {
    diff += renderSeparatorMarker(node, props);
  }
  return diff;
};
const renderChildrenMaybeMultiline = (node, props) => {
  if (node.diffType === "solo") {
    return renderChildrenMultiline(node, props);
  }
  if (node.childComparisonDiffMap.size > 0) {
    return renderChildrenMultiline(node, props);
  }
  return renderChildren(node, props);
};
const renderChildren = (node, props) => {
  const {
    focusedChildWhenSame = "first",
    hasSeparatorBetweenEachChild,
    hasTrailingSeparator,
    skippedMarkers,
    skippedMarkersPlacement = "inside",
    hasMarkersWhenEmpty,
    hasSpacingAroundChildren,
    hasSpacingBetweenEachChild,
  } = node.onelineDiff;

  let startSkippedMarker = "";
  let endSkippedMarker = "";
  if (skippedMarkers) {
    startSkippedMarker = props.startSkippedMarkerDisabled
      ? ""
      : skippedMarkers.start;
    endSkippedMarker = props.endSkippedMarkerDisabled ? "" : skippedMarkers.end;
  }

  let columnsRemainingForChildren = props.columnsRemaining;
  if (columnsRemainingForChildren < 1) {
    return setColor("…", node.color);
  }
  const childrenKeys = node.childrenKeys;
  const { startMarker, endMarker } = node;
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let { focusedChildIndex } = node;
  let minIndex = -1;
  if (focusedChildIndex === undefined) {
    const { firstChildWithDiffKey } = node;
    if (firstChildWithDiffKey === undefined) {
      // added/removed
      if (node.childComparisonDiffMap.size > 0) {
        focusedChildIndex = childrenKeys.length - 1;
        let otherRenderedRange;
        node.otherNode.render({
          ...props,
          onRange: (range) => {
            otherRenderedRange = range;
          },
        });
        minIndex = otherRenderedRange.start;
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
  let hasNextSibling = focusedChildIndex < childrenKeys.length - 1;
  let hasPreviousSibling =
    focusedChildIndex === minIndex
      ? focusedChildIndex > 0
      : focusedChildIndex < childrenKeys.length && focusedChildIndex > 0;
  const startSkippedMarkerWidth = startSkippedMarker.length;
  const endSkippedMarkerWidth = endSkippedMarker.length;
  const { separatorMarkerRef, separatorMarkerWhenTruncatedRef } = node;
  const separatorMarker = separatorMarkerRef ? separatorMarkerRef.current : "";
  const separatorMarkerWhenTruncated = separatorMarkerWhenTruncatedRef
    ? separatorMarkerWhenTruncatedRef.current
    : "";

  let boilerplate = "";
  if (hasPreviousSibling) {
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
  if (hasNextSibling) {
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
    return setColor("…", node.color);
  }
  if (columnsRemainingForChildrenConsideringBoilerplate === 0) {
    return skippedMarkersPlacement === "inside"
      ? setColor(boilerplate, node.color)
      : setColor("…", node.color);
  }

  let childrenDiff = "";
  const renderChildDiff = (childNode, childIndex) => {
    updateChildSeparatorMarkerRef(childNode, {
      hasSeparatorBetweenEachChild,
      hasTrailingSeparator,
      childIndex,
      childrenKeys,
    });
    let columnsRemainingForThisChild = columnsRemainingForChildren;
    if (hasPreviousSibling) {
      columnsRemainingForThisChild -= startSkippedMarkerWidth;
    }
    if (hasNextSibling) {
      columnsRemainingForThisChild -= endSkippedMarkerWidth;
    }
    const childDiff = childNode.render({
      ...props,
      startSkippedMarkerDisabled: hasPreviousSibling && startSkippedMarkerWidth,
      endSkippedMarkerDisabled: hasNextSibling && endSkippedMarkerWidth,
      columnsRemaining: columnsRemainingForThisChild,
      onTruncatedNotationUsed: () => {
        columnsRemainingForChildren = 0;
      },
    });
    return childDiff;
  };
  if (hasSpacingAroundChildren) {
    columnsRemainingForChildren -=
      `${startMarker}  ${endMarker}${separatorMarkerWhenTruncated || separatorMarker}`
        .length;
  } else {
    columnsRemainingForChildren -=
      `${startMarker}${endMarker}${separatorMarkerWhenTruncated || separatorMarker}`
        .length;
  }
  const focusedChildKey = childrenKeys[focusedChildIndex];
  const focusedChildNode = node.childNodeMap.get(focusedChildKey);
  const renderedRange = { start: 0, end: 0 };
  if (focusedChildNode) {
    const focusedChildDiff = renderChildDiff(
      focusedChildNode,
      focusedChildIndex,
    );
    columnsRemainingForChildren -= stringWidth(focusedChildDiff);
    childrenDiff = focusedChildDiff;
    renderedRange.start = renderedRange.end = focusedChildIndex;
    if (focusedChildIndex === minIndex) {
      columnsRemainingForChildren = 0;
    }
  }
  if (columnsRemainingForChildren) {
    for (const childIndex of generateChildIndexes(
      childrenKeys,
      focusedChildIndex,
      minIndex,
    )) {
      if (columnsRemainingForChildren <= 0) {
        break;
      }
      const isPrevious = childIndex < focusedChildIndex;
      if (isPrevious) {
        hasPreviousSibling = childIndex > 0;
      } else {
        hasNextSibling = childIndex < childrenKeys.length - 1;
      }
      const childKey = childrenKeys[childIndex];
      const childNode = node.childNodeMap.get(childKey);
      if (!childNode) {
        debugger; // to keep to see if that is hit while running all of string.test.js
        // if not remove it
        continue;
      }
      const childDiff = renderChildDiff(childNode, childIndex);
      const childDiffWidth = measureRemainingColumnsImpact(childDiff);
      let nextWidth = childDiffWidth;
      if (hasPreviousSibling) {
        nextWidth += startSkippedMarkerWidth;
      }
      if (hasNextSibling) {
        nextWidth += endSkippedMarkerWidth;
      }
      if (nextWidth > columnsRemainingForChildren) {
        break;
      }
      columnsRemainingForChildren -= childDiffWidth;
      if (childIndex < renderedRange.start) {
        renderedRange.start = childIndex;
      } else {
        renderedRange.end = childIndex;
      }
      if (isPrevious) {
        const shouldInjectSpacing =
          hasSpacingBetweenEachChild &&
          (childIndex > 0 || focusedChildIndex > 0);
        if (shouldInjectSpacing) {
          childrenDiff = `${childDiff} ${childrenDiff}`;
          columnsRemainingForChildren -= " ".length;
          continue;
        }
        if (childrenDiff) {
          childrenDiff = `${childDiff}${childrenDiff}`;
          continue;
        }
        childrenDiff = childDiff;
        continue;
      }

      if (hasSpacingBetweenEachChild && childrenDiff) {
        columnsRemainingForChildren -= " ".length;
        childrenDiff = `${childrenDiff} ${childDiff}`;
        continue;
      }
      if (childrenDiff) {
        childrenDiff = `${childrenDiff}${childDiff}`;
        continue;
      }
      childrenDiff = childDiff;
    }
  }

  // if (node.subgroup === 'line_entry_value' && node.firstChildWithDiffKey) {
  //   for (const [, lineNode] of node.parent.childNodeMap) {
  //     if (lineNode === node) continue;
  //     // dis bien aux autre noeuds
  //     // de se render dans ce range
  //     lineNode.childrenRenderRange = renderedRange;
  //     // debugger;
  //   }
  // }
  if (props.onRange) {
    props.onRange(renderedRange);
  }
  let diff = "";
  if (hasPreviousSibling) {
    if (skippedMarkersPlacement === "inside") {
      if (startMarker) {
        diff += setColor(startMarker, node.color);
      }
      diff += setColor(startSkippedMarker, node.color);
    } else {
      diff += setColor(startSkippedMarker, node.color);
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
  if (hasNextSibling) {
    if (skippedMarkersPlacement === "inside") {
      diff += setColor(endSkippedMarker, node.color);
      if (endMarker) {
        diff += setColor(endMarker, node.color);
      }
    } else {
      if (endMarker) {
        diff += setColor(endMarker, node.color);
      }
      diff += setColor(endSkippedMarker, node.color);
    }
  } else if (endMarker) {
    diff += setColor(endMarker, node.color);
  }
  if (separatorMarker) {
    if (
      separatorMarkerWhenTruncated &&
      columnsRemainingForChildren < separatorMarker.length + 1
    ) {
      props.onTruncatedNotationUsed();
      diff += renderSeparatorMarker(node, props, { truncated: true });
    } else {
      diff += renderSeparatorMarker(node, props);
    }
  }
  return diff;
};
function* generateChildIndexes(childrenKeys, startIndex, minIndex) {
  let previousAttempt = 0;
  let nextAttempt = 0;
  let tryBeforeFirst = true;
  while (true) {
    const previousChildIndex = startIndex - previousAttempt - 1;
    const nextChildIndex = startIndex + nextAttempt + 1;
    const hasPreviousChild =
      previousChildIndex === minIndex - 1 ? false : previousChildIndex >= 0;
    const hasNextChild = nextChildIndex < childrenKeys.length;
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
      tryBeforeFirst = true;
    }
  }
}
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
  const indexToDisplayArray = [];
  index_to_display: {
    const maxDiff =
      typeof node.multilineDiff.maxDiff === "number"
        ? node.multilineDiff.maxDiff
        : props[node.multilineDiff.maxDiff];
    if (node.diffType === "solo") {
      for (const [childKey] of node.childComparisonDiffMap) {
        if (indexToDisplayArray.length >= maxDiff) {
          break;
        }
        const childIndex = childrenKeys.indexOf(childKey);
        indexToDisplayArray.push(childIndex);
      }
      indexToDisplayArray.sort();
      break index_to_display;
    }
    if (node.childComparisonDiffMap.size === 0) {
      indexToDisplayArray.push(0);
      break index_to_display;
    }
    if (childrenKeys.length === 0) {
      break index_to_display;
    }
    const diffIndexArray = [];
    for (const [childKey] of node.childComparisonDiffMap) {
      const childIndex = childrenKeys.indexOf(childKey);
      if (childIndex === -1) {
        // happens when removed/added
      } else {
        diffIndexArray.push(childIndex);
      }
    }
    if (diffIndexArray.length === 0) {
      // happens when one node got no diff in itself
      // it's the other that has a diff (added or removed)
      indexToDisplayArray.push(0);
      break index_to_display;
    }
    diffIndexArray.sort();
    const indexToDisplaySet = new Set();
    let diffCount = 0;
    for (const diffIndex of diffIndexArray) {
      if (diffCount >= maxDiff) {
        break;
      }
      diffCount++;
      let beforeDiffIndex = diffIndex - 1;
      let beforeCount = 0;
      while (beforeDiffIndex > -1) {
        if (beforeCount === props.MAX_ENTRY_BEFORE_MULTILINE_DIFF) {
          break;
        }
        indexToDisplaySet.add(beforeDiffIndex);
        beforeCount++;
        beforeDiffIndex--;
      }
      indexToDisplaySet.add(diffIndex);
      let afterDiffIndex = diffIndex + 1;
      let afterCount = 0;
      while (afterDiffIndex < childrenKeys.length) {
        if (afterCount === props.MAX_ENTRY_AFTER_MULTILINE_DIFF) {
          break;
        }
        indexToDisplaySet.add(afterDiffIndex);
        afterCount++;
        afterDiffIndex++;
      }
    }
    for (const indexToDisplay of indexToDisplaySet) {
      indexToDisplayArray.push(indexToDisplay);
    }
    indexToDisplayArray.sort();
  }
  node.indexToDisplayArray = indexToDisplayArray;
  const {
    hasSeparatorBetweenEachChild,
    hasTrailingSeparator,
    hasNewLineAroundChildren,
    hasIndentBeforeEachChild,
    hasIndentBetweenEachChild,
    hasMarkersWhenEmpty,
    skippedMarkers,
  } = node.multilineDiff;

  if (node.beforeRender) {
    node.beforeRender(props);
  }
  const { startMarker, endMarker, separatorMarkerRef } = node;
  const separatorMarker = separatorMarkerRef ? separatorMarkerRef.current : "";
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let atLeastOneEntryDisplayed = null;
  let diff = "";
  let childrenDiff = "";
  const appendChildDiff = (childDiff) => {
    if (atLeastOneEntryDisplayed) {
      childrenDiff += "\n";
      childrenDiff += childDiff;
    } else {
      childrenDiff += childDiff;
      atLeastOneEntryDisplayed = true;
    }
  };
  const appendSkippedSection = (skipCount, skipPosition) => {
    let skippedDiff = "";
    if (hasIndentBeforeEachChild) {
      skippedDiff += "  ".repeat(getNodeDepth(node, props) + 1);
    }
    if (hasIndentBetweenEachChild && skipPosition !== "start") {
      skippedDiff += " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
    }
    const skippedMarker = (skippedMarkers || {
      start: ["↑ 1 value ↑", "↑ {x} values ↑"],
      middle: ["↕ 1 value ↕", "↕ {x} values ↕"],
      end: ["↓ 1 value ↓", "↓ {x} values ↓"],
    })[skipPosition];
    if (skipCount === 1) {
      skippedDiff += setColor(skippedMarker[0], node.color);
    } else {
      skippedDiff += setColor(
        skippedMarker[1].replace("{x}", skipCount),
        node.color,
      );
    }
    appendChildDiff(skippedDiff);
  };
  let previousIndexDisplayed = -1;
  let canResetMaxColumns = hasNewLineAroundChildren;
  let somethingDisplayed = false;
  for (const childIndex of indexToDisplayArray) {
    if (previousIndexDisplayed === -1) {
      if (childIndex > 0) {
        appendSkippedSection(childIndex, "start");
        somethingDisplayed = true;
      }
    } else {
      const intermediateSkippedCount = childIndex - previousIndexDisplayed - 1;
      if (intermediateSkippedCount) {
        appendSkippedSection(intermediateSkippedCount, "middle");
      }
    }
    const childKey = childrenKeys[childIndex];
    const childNode = node.childNodeMap.get(childKey);

    let childDiff = "";
    let columnsRemainingForChild = canResetMaxColumns
      ? props.MAX_COLUMNS
      : props.columnsRemaining;
    if (hasIndentBeforeEachChild) {
      const indent = "  ".repeat(getNodeDepth(node, props) + 1);
      columnsRemainingForChild -= stringWidth(indent);
      childDiff += indent;
    }
    if (hasIndentBetweenEachChild && somethingDisplayed) {
      const indent = " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
      columnsRemainingForChild -= stringWidth(indent);
      childDiff += indent;
    }
    if (separatorMarker) {
      columnsRemainingForChild -= separatorMarker.length;
    }
    updateChildSeparatorMarkerRef(childNode, {
      hasSeparatorBetweenEachChild,
      hasTrailingSeparator,
      childIndex,
      childrenKeys,
    });
    childDiff += childNode.render({
      ...props,
      columnsRemaining: columnsRemainingForChild,
      indexToDisplayArray,
    });
    canResetMaxColumns = true; // because we'll append \n on next entry
    appendChildDiff(childDiff);
    previousIndexDisplayed = childIndex;
    somethingDisplayed = true;
  }
  const lastIndexDisplayed = previousIndexDisplayed;
  if (lastIndexDisplayed > -1) {
    const lastSkippedCount = childrenKeys.length - 1 - lastIndexDisplayed;
    if (lastSkippedCount) {
      appendSkippedSection(lastSkippedCount, "end");
    }
  }
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
  if (separatorMarker) {
    diff += renderSeparatorMarker(node, props);
  }
  return diff;
};
const updateChildSeparatorMarkerRef = (
  childNode,
  {
    hasSeparatorBetweenEachChild,
    hasTrailingSeparator,
    childIndex,
    childrenKeys,
  },
) => {
  const { separatorMarkerRef, separatorMarkerInsideRef } = childNode;
  const selfOrNestedSeparatorMarkerRef =
    separatorMarkerRef || separatorMarkerInsideRef;
  if (!selfOrNestedSeparatorMarkerRef) {
    return;
  }
  const separatorMarker = selfOrNestedSeparatorMarkerRef.current;
  if (!separatorMarker) {
    return;
  }
  if (!hasSeparatorBetweenEachChild) {
    selfOrNestedSeparatorMarkerRef.current = "";
    return;
  }
  if (hasTrailingSeparator) {
    return;
  }
  if (childrenKeys.length === 1) {
    selfOrNestedSeparatorMarkerRef.current = "";
    return;
  }
  if (childIndex === childrenKeys.length - 1) {
    selfOrNestedSeparatorMarkerRef.current = "";
    return;
  }
};
const getNodeDepth = (node, props) => {
  return node.depth - props.startNode.depth;
};
const enableMultilineDiff = (lineEntriesNode) => {
  const firstLineEntryNode = lineEntriesNode.childNodeMap.get(0);
  firstLineEntryNode.onelineDiff.hasMarkersWhenEmpty = false;
  firstLineEntryNode.onelineDiff.skippedMarkersPlacement = "inside";
  firstLineEntryNode.startMarker = firstLineEntryNode.endMarker = "";
  lineEntriesNode.multilineDiff.hasIndentBetweenEachChild = true;
  lineEntriesNode.beforeRender = () => {
    let biggestDisplayedLineIndex = 0;
    for (const index of lineEntriesNode.indexToDisplayArray) {
      if (index > biggestDisplayedLineIndex) {
        biggestDisplayedLineIndex = index;
      }
    }
    for (const index of lineEntriesNode.indexToDisplayArray) {
      const lineNode = lineEntriesNode.childNodeMap.get(index);
      lineNode.onelineDiff.hasMarkersWhenEmpty = true;
      lineNode.startMarker = renderLineStartMarker(
        lineNode,
        biggestDisplayedLineIndex,
      );
    }
  };
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
const renderSeparatorMarker = (node, props, { truncated } = {}) => {
  const {
    separatorMarkerRef,
    separatorMarkerWhenTruncatedRef,
    separatorMarkerOwner,
  } = node;
  const separatorMarker =
    truncated && separatorMarkerWhenTruncatedRef
      ? separatorMarkerWhenTruncatedRef.current
      : separatorMarkerRef.current;
  if (node.diffType === "solo") {
    return setColor(separatorMarker, node.color);
  }
  return setColor(separatorMarker, separatorMarkerOwner.color);
};

const createMethodCallNode = (
  node,
  { objectName, methodName, args, renderOnlyArgs },
) => {
  return {
    render: renderChildren,
    onelineDiff: {
      hasSeparatorBetweenEachChild: true,
      hasTrailingSeparator: true,
    },
    ...getInheritedSeparatorParams(node),
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
const getInheritedSeparatorParams = (node) => {
  return {
    separatorMarkerRef: node.separatorMarkerRef,
    separatorMarkerWhenTruncatedRef: node.separatorMarkerWhenTruncatedRef,
    separatorMarkerOwner: node.separatorMarkerOwner || node,
    // separatorMarkerInsideRef: node.separatorMarkerInsideRef,
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
      hasSeparatorBetweenEachChild: true,
    },
    ...(renderOnlyArgs
      ? {
          ...getInheritedSeparatorParams(node),
        }
      : {}),
    group: "entries",
    subgroup: "arg_entries",
    childGenerator: (callNode) => {
      const appendArgEntry = (argIndex, argValue, { key, ...valueParams }) => {
        callNode.appendChild(argIndex, {
          value: argValue,
          render: renderValue,
          separatorMarkerRef: { current: "," },
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
