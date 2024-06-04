/*
 * LE PLUS DUR QU'IL FAUT FAIRE AVANT TOUT:
 *
 * - assert.not()
 * - assert.any()
 * - ref
 * - url string and url object
 * - well known
 * - symbols
 * - numbers
 * - strings avec multiline
 *   souligne les chars ayant des diffs?
 *   ça aiderais a voir ou est le diff (évite de trop compter sur la couleur)
 * - property descriptors
 * - errors
 * - prototype
 *
 */

import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isValidPropertyIdentifier } from "./property_identifier.js";
import { createValuePath } from "./value_path.js";
import { getObjectTag, objectPrototypeChainGenerator } from "./object_tag.js";
import {
  analyseFunction,
  defaultFunctionAnalysis,
} from "./function_analysis.js";
import { tokenizeString } from "./tokenize_string.js";

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
const measureLastLineColumns = (string) => {
  if (string.includes("\n")) {
    const lines = string.split("\n");
    const lastLine = lines[lines.length - 1];
    return stringWidth(lastLine);
  }
  return stringWidth(string);
};

const customExpectationSymbol = Symbol.for("jsenv_assert_custom_expectation");
const createCustomExpectation = (props) => {
  return {
    [customExpectationSymbol]: true,
    ...props,
  };
};

export const assert = ({
  actual,
  expect,
  MAX_ENTRY_BEFORE_MULTILINE_DIFF = 2,
  MAX_ENTRY_AFTER_MULTILINE_DIFF = 2,
  MAX_DEPTH = 5,
  MAX_DEPTH_INSIDE_DIFF = 1,
  MAX_DIFF_PER_OBJECT = 2,
  MAX_COLUMNS = 100,
}) => {
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
  const compare = (actualNode, expectNode, parent = null) => {
    if (actualNode.ignore) {
      return actualNode.comparison;
    }
    if (expectNode.ignore) {
      return expectNode.comparison;
    }
    const reasons = createReasons();
    const comparison = {
      isComparison: true,
      actualNode,
      expectNode,
      depth: actualNode.depth || expectNode.depth,
      group: actualNode.group || expectNode.group,
      parent,
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

    const subcompareDuo = (actualChildNode, expectChildNode) => {
      const childComparison = compare(
        actualChildNode,
        expectChildNode,
        comparison,
      );
      childComparison.parent = comparison;
      appendReasonGroup(
        comparison.reasons.inside,
        childComparison.reasons.overall,
      );
      return childComparison;
    };
    const subcompareSolo = (childNode, placeholderNode) => {
      if (childNode.name === "actual") {
        return subcompareDuo(childNode, placeholderNode);
      }
      return subcompareDuo(placeholderNode, childNode);
    };
    const subcompareChilNodesDuo = (actualNode, expectNode) => {
      const isSetEntriesComparison =
        actualNode.subgroup === "set_entries" &&
        expectNode.subgroup === "set_entries";
      const isSetEntryComparison =
        actualNode.subgroup === "set_entry" &&
        expectNode.subgroup === "set_entry";
      const comparisonResultMap = new Map();
      const comparisonDiffMap = new Map();
      for (let [childName, actualChildNode] of actualNode.childNodeMap) {
        if (isSetEntryComparison) {
          if (childName === "entry_key") {
            continue;
          }
        }
        let expectChildNode;
        if (isSetEntriesComparison) {
          const actualSetValueNode =
            actualChildNode.childNodeMap.get("entry_value");
          for (const [, expectSetEntryNode] of expectNode.childNodeMap) {
            const expectSetValueNode =
              expectSetEntryNode.childNodeMap.get("entry_value");
            if (expectSetValueNode.value === actualSetValueNode.value) {
              expectChildNode = expectSetEntryNode;
              break;
            }
          }
        } else {
          expectChildNode = expectNode.childNodeMap.get(childName);
        }
        if (actualChildNode && expectChildNode) {
          const childComparison = subcompareDuo(
            actualChildNode,
            expectChildNode,
          );
          comparisonResultMap.set(childName, childComparison);
          if (childComparison.hasAnyDiff) {
            comparisonDiffMap.set(childName, childComparison);
          }
        } else {
          const addedChildComparison = subcompareSolo(
            actualChildNode,
            PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
          );
          comparisonResultMap.set(childName, addedChildComparison);
          comparisonDiffMap.set(childName, addedChildComparison);
        }
      }
      for (let [childName, expectChildNode] of expectNode.childNodeMap) {
        if (isSetEntryComparison) {
          if (childName === "entry_key") {
            continue;
          }
        }
        if (isSetEntriesComparison) {
          const expectSetValueNode =
            expectChildNode.childNodeMap.get("entry_value");
          let hasEntry;
          for (const [, actualSetEntryNode] of actualNode.childNodeMap) {
            const actualSetValueNode =
              actualSetEntryNode.childNodeMap.get("entry_value");
            if (actualSetValueNode.value === expectSetValueNode.value) {
              hasEntry = true;
              break;
            }
          }
          if (hasEntry) {
            continue;
          }
        } else if (comparisonResultMap.has(childName)) {
          continue;
        }
        const removedChildComparison = subcompareSolo(
          expectChildNode,
          PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
        );
        comparisonResultMap.set(childName, removedChildComparison);
        comparisonDiffMap.set(childName, removedChildComparison);
      }
      actualNode.comparisonDiffMap = comparisonDiffMap;
      expectNode.comparisonDiffMap = comparisonDiffMap;
    };
    const subcompareChildNodesSolo = (node, placeholderNode) => {
      const comparisonDiffMap = new Map();
      for (const [childName, childNode] of node.childNodeMap) {
        const soloChildComparison = subcompareSolo(childNode, placeholderNode);
        comparisonDiffMap.set(childName, soloChildComparison);
      }
      node.comparisonDiffMap = comparisonDiffMap;
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

      if (actualNode.isPrimitive) {
        if (actualNode.value === expectNode.value) {
          let compared = false;
          actualNode.render = (props) => {
            if (!compared) {
              compared = true;
              subcompareChilNodesDuo(actualNode, expectNode);
            }
            return renderPrimitive(actualNode, props);
          };
          expectNode.render = (props) => {
            if (!compared) {
              compared = true;
              subcompareChilNodesDuo(actualNode, expectNode);
            }
            return renderPrimitive(expectNode, props);
          };
        } else {
          onSelfDiff("primitive_value");
          subcompareChilNodesDuo(actualNode, expectNode);
        }

        return;
      }
      if (actualNode.isComposite) {
        let compared = false;
        if (actualNode.value === expectNode.value) {
          actualNode.render = (props) => {
            if (!compared) {
              compared = true;
              subcompareChilNodesDuo(actualNode, expectNode);
            }
            return renderComposite(actualNode, props);
          };
          expectNode.render = (props) => {
            if (!compared) {
              compared = true;
              subcompareChilNodesDuo(actualNode, expectNode);
            }
            return renderComposite(expectNode, props);
          };
        } else {
          subcompareChilNodesDuo(actualNode, expectNode);
        }
        return;
      }
      if (actualNode.group === "entries") {
        if (actualNode.hasMarkersWhenEmpty !== expectNode.hasMarkersWhenEmpty) {
          actualNode.hasMarkersWhenEmpty =
            expectNode.hasMarkersWhenEmpty = true;
        }
      }
      subcompareChilNodesDuo(actualNode, expectNode);
    };
    const visitSolo = (node, placeholderNode) => {
      if (node.comparison) {
        throw new Error(`node (${node.subgroup}) already compared`);
      }
      node.comparison = comparison;
      subcompareChildNodesSolo(node, placeholderNode);
    };

    let actualSkipSettle = false;
    let expectSkipSettle = false;
    visit: {
      // comparing primitives
      if (actualNode.isPrimitive && expectNode.isPrimitive) {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      // comparing composites
      if (actualNode.isComposite && expectNode.isComposite) {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      // comparing entries/entry
      if (actualNode.group === "entries" && expectNode.group === "entries") {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      if (actualNode.group === "entry" && expectNode.group === "entry") {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      // primitive vs composite
      if (actualNode.isPrimitive && expectNode.isComposite) {
        onSelfDiff("should_be_composite");
        const expectAsPrimitiveNode = asPrimitiveNode(expectNode);
        if (expectAsPrimitiveNode) {
          const primitiveComparison = subcompareDuo(
            actualNode,
            expectAsPrimitiveNode,
          );
          // actualSkipSettle so that it's the comparison with expectAsPrimitive
          // who sets diffType + color of actualNode
          actualSkipSettle = true;
          expectAsPrimitiveNode.ignore = true;
          expectAsPrimitiveNode.comparison = primitiveComparison;
          visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
        } else {
          visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
          visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
        }
        break visit;
      }
      // composite vs primitive
      if (actualNode.isComposite && expectNode.isPrimitive) {
        onSelfDiff("should_be_primitive");
        const actualAsPrimitiveNode = asPrimitiveNode(actualNode);
        if (actualAsPrimitiveNode) {
          const primitiveComparison = subcompareDuo(
            actualAsPrimitiveNode,
            expectNode,
          );
          // expectSkipSettle so that it's the comparison with expectAsPrimitive
          // who sets diffType + color of expectNode
          expectSkipSettle = true;
          actualAsPrimitiveNode.ignore = true;
          actualAsPrimitiveNode.comparison = primitiveComparison;
          visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
        } else {
          visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
          visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
        }
        break visit;
      }
      if (
        (actualNode.isPrimitive || actualNode.isComposite) &&
        expectNode.isCustomExpectation
      ) {
        const expectAsNode = getWrappedNode(expectNode, () => true);
        if (expectAsNode) {
          // ici on veut on truc bien spécial
          // qu'on va surement déplacer dans la custom expect du coup
          // on fait la comparaison mais avec des couleurs désactivé (ça se sera que pour not)
          // et si la sous-comparaison marche alors on visite assert.not
          // en mode PLACHOLDER_FOR_NOTHING en ignorant le noeud dans assert.not()
          // si la comparaison échoue alors on visit assert.not() avec un placeholder
          // pour considérer qu'il a fonctionné
          const customComparison = subcompareDuo(actualNode, expectNode);
          expectSkipSettle = true;
          expectAsNode.ignore = true;
          expectAsNode.comparison = customComparison;
          visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
          break visit;
        }
      }
      if (expectNode.placeholder) {
        visitSolo(actualNode, expectNode);
        onAdded(getAddedOrRemovedReason(actualNode));
        break visit;
      }
      if (actualNode.placeholder) {
        visitSolo(expectNode, actualNode);
        onRemoved(getAddedOrRemovedReason(expectNode));
        break visit;
      }
      throw new Error(
        `compare not implemented for ${actualNode.subgroup} and ${expectNode.subgroup}`,
      );
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

    const updateColor = (node) => {
      node.color = {
        solo: node.colorWhenSolo,
        modified: node.colorWhenModified,
        same: node.colorWhenSame,
      }[node.diffType];
    };

    if (actualNode.placeholder) {
      expectNode.diffType =
        actualNode === PLACEHOLDER_FOR_NOTHING ? "modified" : "solo";
      updateColor(expectNode);
    } else if (expectNode.placeholder) {
      actualNode.diffType =
        expectNode === PLACEHOLDER_FOR_NOTHING ? "modified" : "solo";
      updateColor(actualNode);
    } else if (comparison.selfHasModification) {
      if (!actualSkipSettle) {
        actualNode.diffType = "modified";
        updateColor(actualNode);
      }
      if (!expectSkipSettle) {
        expectNode.diffType = "modified";
        updateColor(expectNode);
      }
    } else {
      actualNode.diffType = "same";
      expectNode.diffType = "same";
      updateColor(actualNode);
      updateColor(expectNode);
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

assert.not = (value) => {
  return createCustomExpectation({
    parse: (node) => {
      node.childGenerator = () => {
        node.appendChild(
          "assert_not_call",
          createMethodCallNode(node, {
            objectName: "assert",
            methodName: "not",
            args: [{ value }],
          }),
        );
      };
      node.appendWrappedNodeGetter = () => {
        return node.childNodeMap
          .get("assert_not_call")
          .get("method_call")
          .childNodeMap.get(0)
          .get("entry_value");
      };
    },
    render: (node, props) => {
      let diff = "";
      const assertNotCallNode = node.childNodeMap.get("assert_not_call");
      diff += assertNotCallNode.render(props);
      return diff;
    },
    group: "custom_expectation",
    subgroup: "assert_not",
    value,
  });
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
    const rootNode = createNode({
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
      group: "root",
      value,
      parent: null,
      depth: 0,
      path: createValuePath(),
      render,
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
    value,
    parent,
    depth,
    path,
    childGenerator,
    isSourceCode = false,
    isFunctionPrototype = false,
    isClassPrototype = false,
    isValueOfReturnValue = false,
    render,
    methodName = "",
    isHidden = false,
    startMarker = "",
    middleMarker = "",
    endMarker = "",
    overflowStartMarker = "",
    overflowEndMarker = "",
    isCompatibleWithMultilineDiff = false,
    isCompatibleWithSingleLineDiff = false,
    skippedEntrySummary = null,
    hasMarkersWhenEmpty = false,
    hasNewLineAroundEntries = false,
    hasSpacingAroundEntries = false,
    hasIndentBeforeEntries = false,
    hasTrailingSeparator = false,
  }) => {
    const node = {
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
      group,
      subgroup,
      value,
      childGenerator,
      childNodeMap: null,
      appendChild: (childKey, params) =>
        appendChildNodeGeneric(node, childKey, params),
      wrappedNodeGetterSet: new Set(),
      appendWrappedNodeGetter: (getter) => {
        node.wrappedNodeGetterSet.add(getter);
      },
      parent,
      depth,
      path,
      isSourceCode,
      isClassPrototype,
      isValueOfReturnValue,
      // info
      isPrimitive: false,
      isComposite: false,
      // info/primitive
      isUndefined: false,
      isString: false,
      isNumber: false,
      isSymbol: false,
      // info/composite
      isFunction: false,
      functionAnalysis: defaultFunctionAnalysis,
      isArray: false,
      isMap: false,
      isSet: false,
      // render info
      render: (props) => render(node, props),
      methodName,
      isHidden,
      // START will be set by comparison
      ignore: false,
      comparison: null,
      comparisonDiffMap: null,
      diffType: "",
      otherNode: null,
      // END will be set by comparison
      hasQuotes: false,
      startMarker,
      middleMarker,
      endMarker,
      overflowStartMarker,
      overflowEndMarker,
      isCompatibleWithMultilineDiff,
      isCompatibleWithSingleLineDiff,
      skippedEntrySummary,
      hasMarkersWhenEmpty,
      hasNewLineAroundEntries,
      hasSpacingAroundEntries,
      hasIndentBeforeEntries,
      hasTrailingSeparator,
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
          let value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    }
    Object.preventExtensions(node);
    if (value && value[customExpectationSymbol]) {
      const { parse, render, group, subgroup } = value;
      node.isCustomExpectation = true;
      if (parse) {
        parse(node);
      }
      node.render = render;
      node.group = group;
      node.subgroup = subgroup;
      return node;
    }
    if (
      value === SOURCE_CODE_ENTRY_KEY ||
      value === VALUE_OF_RETURN_VALUE_ENTRY_KEY ||
      value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY
    ) {
      node.isPrimitive = true;
      node.isString = true;
      return node;
    }
    if (group === "entries") {
      return node;
    }
    if (group === "entry") {
      return node;
    }
    if (
      subgroup === "array_entry_key" ||
      subgroup === "line_entry_key" ||
      subgroup === "char_entry_key" ||
      subgroup === "function_call_arg_entry_key"
    ) {
      node.isPrimitive = true;
      node.isNumber = true;
      return node;
    }
    if (subgroup === "char_entry_value") {
      node.isPrimitive = true;
      node.isString = true;
      return node;
    }
    if (value === null) {
      node.isPrimitive = true;
      return node;
    }
    const typeofResult = typeof value;
    const isObject = typeofResult === "object";
    const isFunction = typeofResult === "function";
    if (isObject || isFunction) {
      node.isComposite = true;
      if (isFunction) {
        node.isFunction = true;
        node.functionAnalysis = analyseFunction(value);
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
      }
      node.childGenerator = function () {
        // function child nodes
        if (node.isFunction) {
          if (node.functionAnalysis.type === "class") {
            node.appendChild("class_keyword", {
              render: renderGrammar,
              group: "grammar",
              subgroup: "class_keyword",
              value: "class",
            });
            const extendedClassName = node.functionAnalysis.extendedClassName;
            if (extendedClassName) {
              node.appendChild("class_extends_keyword", {
                render: renderGrammar,
                group: "grammar",
                subgroup: "class_extends_keyword",
                value: "extends",
              });
              node.appendChild("class_extended_name", {
                render: renderGrammar,
                group: "grammar",
                subgroup: "class_extended_name",
                value: extendedClassName,
              });
            }
          }
          if (node.functionAnalysis.isAsync) {
            node.appendChild("function_async_keyword", {
              render: renderGrammar,
              group: "grammar",
              subgroup: "function_async_keyword",
              value: "async",
            });
          }
          if (node.functionAnalysis.type === "classic") {
            node.appendChild("function_keyword", {
              render: renderGrammar,
              group: "grammar",
              subgroup: "function_keyword",
              value: node.functionAnalysis.isGenerator
                ? "function*"
                : "function",
            });
          }
          if (node.functionAnalysis.name) {
            node.appendChild("function_name", {
              render: renderGrammar,
              group: "grammar",
              subgroup: "function_name",
              value: node.functionAnalysis.name,
            });
          }
          function_body_prefix: {
            const functionBodyPrefixParams = {
              render: renderGrammar,
              group: "grammar",
              subgroup: "function_body_prefix",
            };
            if (node.functionAnalysis.type === "arrow") {
              node.appendChild("function_body_prefix", {
                ...functionBodyPrefixParams,
                value: "() =>",
              });
            } else if (node.functionAnalysis.type === "method") {
              if (node.functionAnalysis.getterName) {
                node.appendChild("function_body_prefix", {
                  ...functionBodyPrefixParams,
                  value: `get ${methodName}()`,
                });
              }
              if (node.functionAnalysis.setterName) {
                node.appendChild("function_body_prefix", {
                  ...functionBodyPrefixParams,
                  value: `set ${methodName}()`,
                });
              }
              node.appendChild("function_body_prefix", {
                ...functionBodyPrefixParams,
                value: `${methodName}()`,
              });
            } else if (node.functionAnalysis.type === "classic") {
              node.appendChild("function_body_prefix", {
                ...functionBodyPrefixParams,
                value: "()",
              });
            }
          }
        }
        let hasObjectTag = false;
        // object_tag
        if (!node.isFunction && !isFunctionPrototype) {
          const objectTag = getObjectTag(value);
          if (objectTag && objectTag !== "Object" && objectTag !== "Array") {
            hasObjectTag = true;
            node.appendChild("object_tag", {
              render: renderGrammar,
              group: "grammar",
              subgroup: "object_tag",
              value: objectTag,
              path: node.path.append("[[ObjectTag]]"),
            });
          }
        }
        let canHaveInternalEntries = false;
        internal_entries: {
          const internalEntriesParams = {
            render: renderEntries,
            group: "entries",
            value: [],
            startMarker: "(",
            endMarker: ")",
            isCompatibleWithMultilineDiff: true,
            isCompatibleWithSingleLineDiff: true,
            hasMarkersWhenEmpty: true,
            hasNewLineAroundEntries: true,
            hasIndentBeforeEntries: true,
            hasTrailingSeparator: true,
            skippedEntrySummary: {
              skippedEntryNames: ["value", "values"],
            },
          };

          if (node.isMap) {
            canHaveInternalEntries = true;
            const mapEntriesNode = node.appendChild("internal_entries", {
              ...internalEntriesParams,
              subgroup: "map_entries",
              childGenerator: () => {
                for (const [mapEntryKey, mapEntryValue] of value) {
                  mapEntriesNode.value.push(mapEntryKey);
                  const mapEntryNode = mapEntriesNode.appendChild(mapEntryKey, {
                    render: renderEntry,
                    group: "entry",
                    subgroup: "map_entry",
                    // TODO: map path
                    middleMarker: " => ",
                    endMarker: ",",
                  });
                  mapEntryNode.appendChild("entry_key", {
                    render: renderValue,
                    group: "entry_key",
                    subgroup: "map_entry_key",
                    value: mapEntryKey,
                  });
                  mapEntryNode.appendChild("entry_value", {
                    render: renderValue,
                    childType: "entry_value",
                    subgroup: "map_entry_value",
                    value: mapEntryValue,
                  });
                }
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
                  setEntriesNode.value.push(index);
                  const setEntryNode = setEntriesNode.appendChild(index, {
                    render: renderEntry,
                    group: "entry",
                    subgroup: "set_entry",
                    path: setEntriesNode.path.append(index, {
                      isIndexedEntry: true,
                    }),
                    middleMarker: " => ",
                    endMarker: ",",
                  });
                  setEntryNode.appendChild("entry_key", {
                    render: renderInteger,
                    group: "entry_key",
                    subgroup: "set_entry_key",
                    value: index,
                    isHidden: true,
                  });
                  setEntryNode.appendChild("entry_value", {
                    render: renderValue,
                    group: "entry_value",
                    subgroup: "set_entry_value",
                    value: setValue,
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
              render: renderEntries,
              group: "entries",
              subgroup: "array_entries",
              value: [],
              startMarker: "[",
              endMarker: "]",
              hasMarkersWhenEmpty: true,
              isCompatibleWithMultilineDiff: true,
              isCompatibleWithSingleLineDiff: true,
              hasNewLineAroundEntries: true,
              hasIndentBeforeEntries: true,
              hasTrailingSeparator: true,
              skippedEntrySummary: {
                skippedEntryNames: ["value", "values"],
              },
            });
            const arrayEntyGenerator = () => {
              let index = 0;
              while (index < value.length) {
                ownPropertyNameToIgnoreSet.add(String(index));
                arrayEntriesNode.value.push(index);
                const arrayEntryNode = arrayEntriesNode.appendChild(index, {
                  render: renderEntry,
                  group: "entry",
                  subgroup: "array_entry",
                  path: arrayEntriesNode.path.append(index, {
                    isIndexedEntry: true,
                  }),
                  endMarker: ",",
                });
                arrayEntryNode.appendChild("entry_key", {
                  render: renderInteger,
                  group: "entry_key",
                  subgroup: "array_entry_key",
                  value: index,
                  isHidden: true,
                });
                arrayEntryNode.appendChild("entry_value", {
                  render: renderValue,
                  group: "entry_value",
                  subgroup: "array_entry_value",
                  value: Object.hasOwn(value, index)
                    ? value[index]
                    : ARRAY_EMPTY_VALUE,
                });
                index++;
              }
            };
            arrayEntyGenerator();
          }
        }
        let hasConstructorCall;
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
        value_of: {
          if (
            typeof value.valueOf === "function" &&
            value.valueOf !== Object.prototype.valueOf
          ) {
            ownPropertyNameToIgnoreSet.add("valueOf");
            const valueOfReturnValue = value.valueOf();
            if (hasObjectTag) {
              hasConstructorCall = true;
              node.appendChild(
                "constructor_call",
                createFunctionCallNode(node, {
                  args: [
                    {
                      key: "valueOf()",
                      value: valueOfReturnValue,
                      isValueOfReturnValue: true,
                    },
                  ],
                }),
              );
            } else {
              propertyLikeCallbackSet.add((appendPropertyEntryNode) => {
                appendPropertyEntryNode(VALUE_OF_RETURN_VALUE_ENTRY_KEY, {
                  value: valueOfReturnValue,
                });
              });
            }
          }
        }
        own_properties: {
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
            ownPropertyNames.length === 0 &&
            propertyLikeCallbackSet.size === 0;
          if (skipOwnProperties) {
            break own_properties;
          }
          const hasMarkersWhenEmpty =
            !hasObjectTag &&
            !hasConstructorCall &&
            !canHaveInternalEntries &&
            !canHaveIndexedEntries;
          const propertyEntriesNode = node.appendChild("property_entries", {
            render: renderEntries,
            group: "entries",
            subgroup: "property_entries",
            value: [],
            isCompatibleWithMultilineDiff: true,
            isCompatibleWithSingleLineDiff: true,
            skippedEntrySummary: {
              skippedEntryNames: ["prop", "props"],
            },
            ...(node.isClassPrototype
              ? {}
              : {
                  startMarker: "{",
                  endMarker: "}",
                  hasSpacingAroundEntries: true,
                  hasNewLineAroundEntries: true,
                  hasIndentBeforeEntries: true,
                  hasTrailingSeparator: true,
                }),
            hasMarkersWhenEmpty,
            childGenerator: () => {
              const appendPropertyEntryNode = (
                key,
                {
                  value,
                  isSourceCode,
                  isClassStaticProperty,
                  isFunctionPrototype,
                  isClassPrototype,
                },
              ) => {
                propertyEntriesNode.value.push(key);
                const propertyEntryNode = propertyEntriesNode.appendChild(key, {
                  render: renderEntry,
                  group: "entry",
                  subgroup: "property_entry",
                  path: node.path.append(key),
                  isFunctionPrototype,
                  isClassPrototype,
                  ...(node.isClassPrototype
                    ? {}
                    : isClassStaticProperty
                      ? {
                          middleMarker: " = ",
                          endMarker: ";",
                        }
                      : {
                          middleMarker: ": ",
                          endMarker: ",",
                        }),
                  childGenerator: () => {
                    const propertyEntryValueNode =
                      propertyEntryNode.appendChild("entry_value", {
                        render: renderValue,
                        group: "entry_value",
                        subgroup: "property_entry_value",
                        value,
                        isSourceCode,
                        isFunctionPrototype,
                        isClassPrototype,
                        methodName: key,
                      });
                    if (isClassStaticProperty && !isClassPrototype) {
                      propertyEntryNode.appendChild("static_keyword", {
                        render: renderGrammar,
                        group: "grammar",
                        subgroup: "static_keyword",
                        value: "static",
                        isHidden:
                          isSourceCode ||
                          propertyEntryValueNode.functionAnalysis.type ===
                            "method",
                      });
                    }
                    propertyEntryNode.appendChild("entry_key", {
                      render: renderString,
                      group: "entry_key",
                      subgroup: "property_entry_key",
                      value: key,
                      isHidden:
                        isSourceCode ||
                        propertyEntryValueNode.functionAnalysis.type ===
                          "method" ||
                        isClassPrototype,
                    });
                  },
                });
                return propertyEntryNode;
              };

              if (node.isFunction) {
                appendPropertyEntryNode(SOURCE_CODE_ENTRY_KEY, {
                  value: node.functionAnalysis.argsAndBodySource,
                  isSourceCode: true,
                  isClassStaticProperty: node.functionAnalysis.type === "class",
                });
              }
              for (const ownPropertyName of ownPropertyNames) {
                const ownPropertyValue = node.value[ownPropertyName];
                appendPropertyEntryNode(ownPropertyName, {
                  value: ownPropertyValue,
                  isClassStaticProperty: node.functionAnalysis.type === "class",
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

      node.appendWrappedNodeGetter(() => {
        const propertyEntriesNode = node.childNodeMap.get("property_entries");
        if (!propertyEntriesNode) {
          return null;
        }
        const symbolToPrimitiveReturnValuePropertyNode =
          propertyEntriesNode.childNodeMap.get(
            SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY,
          );
        if (!symbolToPrimitiveReturnValuePropertyNode) {
          return null;
        }
        return symbolToPrimitiveReturnValuePropertyNode.childNodeMap.get(
          "entry_value",
        );
      });
      node.appendWrappedNodeGetter(() => {
        const constructorCallNode = node.childNodeMap.get("constructor_call");
        if (constructorCallNode) {
          const firstArgEntryNode = constructorCallNode.childNodeMap.get(0);
          if (
            firstArgEntryNode &&
            firstArgEntryNode.childNodeMap.get("entry_value")
              .isValueOfReturnValue
          ) {
            return firstArgEntryNode.childNodeMap.get("entry_value");
          }
        }
        const propertyEntriesNode = node.childNodeMap.get("property_entries");
        if (!propertyEntriesNode) {
          return null;
        }
        const valueOfReturnValuePropertyNode =
          propertyEntriesNode.childNodeMap.get(VALUE_OF_RETURN_VALUE_ENTRY_KEY);
        if (!valueOfReturnValuePropertyNode) {
          return null;
        }
        return valueOfReturnValuePropertyNode.childNodeMap.get("entry_value");
      });

      return node;
    }

    node.isPrimitive = true;
    if (typeofResult === "string") {
      node.isString = true;
      if (group === "grammar") {
      } else {
        if (subgroup === "property_entry_key") {
          if (!isValidPropertyIdentifier(value)) {
            node.hasQuotes = true;
          }
        } else {
          node.hasQuotes = true;
        }
        node.childGenerator = () => {
          const lineEntriesNode = node.appendChild("line_entries", {
            render: renderEntries,
            group: "entries",
            subgroup: "line_entries",
            value: [],
            isCompatibleWithMultilineDiff: true,
            skippedEntrySummary: {
              skippedEntryNames: ["line", "lines"],
            },
            childGenerator: () => {
              const appendLineEntry = (lineIndex) => {
                lineEntriesNode.value.push(lineIndex);
                const lineEntryNode = lineEntriesNode.appendChild(lineIndex, {
                  render: renderEntry,
                  group: "entry",
                  subgroup: "line_entry",
                });
                const lineEntryKeyNode = lineEntryNode.appendChild(
                  "entry_key",
                  {
                    render: renderInteger,
                    group: "entry_key",
                    subgroup: "line_entry_key",
                    value: lineIndex,
                    isHidden: true,
                  },
                );
                const lineEntryValueNode = lineEntryNode.appendChild(
                  "entry_value",
                  {
                    render: renderEntries,
                    group: "entries",
                    subgroup: "line_entry_value",
                    value: [],
                    overflowStartMarker: "…",
                    overflowEndMarker: "…",
                  },
                );
                const appendCharEntry = (charIndex, char) => {
                  lineEntryValueNode.value.push(charIndex);
                  const charEntryNode = lineEntryValueNode.appendChild(
                    charIndex,
                    {
                      render: renderEntry,
                      group: "entry",
                      subgroup: "char_entry",
                    },
                  );
                  charEntryNode.appendChild("entry_key", {
                    render: renderInteger,
                    group: "entry_key",
                    subgroup: "char_entry_key",
                    value: charIndex,
                    isHidden: true,
                  });
                  charEntryNode.appendChild("entry_value", {
                    render: renderChar,
                    group: "entry_value",
                    subgroup: "char_entry_value",
                    value: char,
                  });
                };

                return {
                  lineEntryNode,
                  lineEntryKeyNode,
                  lineEntryValueNode,
                  appendCharEntry,
                };
              };

              let isDone = false;
              let firstLineCharIndex = 0;
              let doubleQuoteCount = 0;
              let singleQuoteCount = 0;
              let backtickCount = 0;
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
                lineEntryValueNode: firstLineEntryValueNode,
                appendCharEntry: appendFirstLineCharEntry,
              } = appendLineEntry(0);
              for (const char of charGeneratorUntilNewLine()) {
                if (char === DOUBLE_QUOTE) {
                  doubleQuoteCount++;
                } else if (char === SINGLE_QUOTE) {
                  singleQuoteCount++;
                } else if (char === BACKTICK) {
                  backtickCount++;
                }
                appendFirstLineCharEntry(firstLineCharIndex, char);
                firstLineCharIndex++;
              }

              if (isDone) {
                // single line
                if (node.hasQuotes) {
                  let bestQuote;
                  if (doubleQuoteCount === 0) {
                    bestQuote = DOUBLE_QUOTE;
                  } else if (singleQuoteCount === 0) {
                    bestQuote = SINGLE_QUOTE;
                  } else if (backtickCount === 0) {
                    bestQuote = BACKTICK;
                  } else if (singleQuoteCount > doubleQuoteCount) {
                    bestQuote = DOUBLE_QUOTE;
                  } else if (doubleQuoteCount > singleQuoteCount) {
                    bestQuote = SINGLE_QUOTE;
                  } else {
                    bestQuote = DOUBLE_QUOTE;
                  }
                  firstLineEntryValueNode.startMarker =
                    firstLineEntryValueNode.endMarker = bestQuote;
                  lineEntriesNode.hasMarkersWhenEmpty = true;
                }
                lineEntriesNode.hasMarkersWhenEmpty = true;
                return;
              }
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
      }
    }
    if (value === undefined) {
      node.isUndefined = true;
    }

    return node;
  };

  const appendChildNodeGeneric = (node, childKey, params) => {
    const childNode = createNode({
      colorWhenSolo: node.colorWhenSolo,
      colorWhenSame: node.colorWhenSame,
      colorWhenModified: node.colorWhenModified,
      name: node.name,
      parent: node,
      path: node.path,
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
  if (node.isPrimitive) {
    return renderPrimitive(node, props);
  }
  return renderComposite(node, props);
};
const renderPrimitive = (node, props) => {
  if (props.columnsRemaining < 1) {
    return setColor("…", node.color);
  }
  if (node.isSourceCode) {
    return truncateAndAppyColor("[source code]", node, props);
  }
  if (node.isUndefined) {
    return truncateAndAppyColor("undefined", node, props);
  }
  if (node.isString) {
    return renderString(node, props);
  }
  return truncateAndAppyColor(JSON.stringify(node.value), node, props);
};
const renderString = (node, props) => {
  if (node.value === VALUE_OF_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndAppyColor("valueOf()", node, props);
  }
  if (node.value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndAppyColor("[Symbol.toPrimitive()]", node, props);
  }
  const lineEntriesNode = node.childNodeMap.get("line_entries");
  if (lineEntriesNode) {
    return lineEntriesNode.render(props);
  }
  let diff = JSON.stringify(node.value);
  if (node.hasQuotes) {
    return truncateAndAppyColor(diff, node, props);
  }
  return truncateAndAppyColor(diff.slice(1, -1), node, props);
};
const renderChar = (node, props) => {
  const char = node.value;
  if (char === node.parent.parent.parent.parent.startMarker) {
    return truncateAndAppyColor(`\\${char}`, node, props);
  }
  const point = char.charCodeAt(0);
  if (point === 92 || point < 32 || (point > 126 && point < 160)) {
    return truncateAndAppyColor(CHAR_TO_ESCAPED_CHAR[point], node, props);
  }
  return truncateAndAppyColor(char, node, props);
};
const renderInteger = (node, props) => {
  let diff = JSON.stringify(node.value);
  return truncateAndAppyColor(diff, node, props);
};
const renderGrammar = (node, props) => {
  return truncateAndAppyColor(node.value, node, props);
};
const truncateAndAppyColor = (diff, node, props) => {
  if (diff.length > props.columnsRemaining) {
    diff = setColor(diff.slice(0, props.columnsRemaining - 1), node.color);
    diff += setColor("…", node.color);
    return diff;
  }
  return setColor(diff, node.color);
};

const renderComposite = (node, props) => {
  // it's here that at some point we'll compare more than just own properties
  // because composite also got a prototype
  // and a constructor that might differ
  let diff = "";
  const internalEntriesNode = node.childNodeMap.get("internal_entries");
  const indexedEntriesNode = node.childNodeMap.get("indexed_entries");
  const propertyEntriesNode = node.childNodeMap.get("property_entries");
  if (props.columnsRemaining < 2) {
    diff = setColor("…", node.color);
    return diff;
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
  if (maxDepthReached) {
    if (indexedEntriesNode) {
      const arrayLength = indexedEntriesNode.value.length;
      diff += setColor(`Array(${arrayLength})`, node.color);
      return diff;
    }
    const propertyNameCount = propertyEntriesNode.value.length;
    diff += setColor(`Object(${propertyNameCount})`, node.color);
    return diff;
  }
  let columnsRemaining = props.columnsRemaining;
  if (node.isFunction) {
    const functionDiff = renderFunction(node, props);
    columnsRemaining -= measureLastLineColumns(functionDiff);
    diff += functionDiff;
  } else {
    const objectTagNode = node.childNodeMap.get("object_tag");
    if (objectTagNode) {
      const objectTagDiff = objectTagNode.render(props);
      columnsRemaining -= measureLastLineColumns(objectTagDiff);
      diff += objectTagDiff;
    }
    const constructorCallNode = node.childNodeMap.get("constructor_call");
    if (constructorCallNode) {
      const constructorCallDiff = constructorCallNode.render({
        ...props,
        columnsRemaining,
      });
      columnsRemaining -= measureLastLineColumns(constructorCallDiff);
      diff += constructorCallDiff;
    }
  }
  if (internalEntriesNode) {
    const internalEntriesDiff = internalEntriesNode.render({
      ...props,
      columnsRemaining,
    });
    columnsRemaining -= measureLastLineColumns(internalEntriesDiff);
    diff += internalEntriesDiff;
  }
  if (indexedEntriesNode) {
    if (diff) {
      columnsRemaining -= " ".length;
      diff += " ";
    }
    const indexedEntriesDiff = indexedEntriesNode.render({
      ...props,
      columnsRemaining,
    });
    columnsRemaining -= measureLastLineColumns(indexedEntriesDiff);
    diff += indexedEntriesDiff;
  }
  if (propertyEntriesNode) {
    const propertiesDiff = propertyEntriesNode.render({
      ...props,
      columnsRemaining,
    });
    if (propertiesDiff) {
      if (diff) {
        columnsRemaining -= " ".length;
        diff += " ";
      }
      diff += propertiesDiff;
    }
  }
  return diff;
};
const renderFunction = (node, props) => {
  let diff = "";
  const classKeywordNode = node.childNodeMap.get("class_keyword");
  if (classKeywordNode) {
    diff += classKeywordNode.render(props);
  } else {
    const asyncKeywordNode = node.childNodeMap.get("function_async_keyword");
    if (asyncKeywordNode) {
      diff += asyncKeywordNode.render(props);
    }
  }
  const functionKeywordNode = node.childNodeMap.get("function_keyword");
  if (functionKeywordNode) {
    if (diff) {
      diff += " ";
    }
    diff += functionKeywordNode.render(props);
  }
  const functionNameNode = node.childNodeMap.get("function_name");
  if (functionNameNode) {
    if (diff) {
      diff += " ";
    }
    diff += functionNameNode.render(props);
  }
  const classExtendedNameNode = node.childNodeMap.get("class_extended_name");
  if (classExtendedNameNode) {
    const classExtendsKeywordNode = node.childNodeMap.get(
      "class_extends_keyword",
    );
    diff += " ";
    diff += classExtendsKeywordNode.render(props);
    diff += " ";
    diff += classExtendedNameNode.render(props);
  }
  const functionBodyPrefixNode = node.childNodeMap.get("function_body_prefix");
  if (functionBodyPrefixNode) {
    if (diff) {
      diff += " ";
    }
    diff += functionBodyPrefixNode.render(props);
  }
  return diff;
};
const renderEntries = (node, props) => {
  if (!node.isCompatibleWithMultilineDiff) {
    return renderEntriesOneLiner(node, props);
  }
  if (node.diffType === "solo") {
    const indexToDisplayArray = [];
    for (const [entryKey] of node.comparisonDiffMap) {
      if (indexToDisplayArray.length >= props.MAX_DIFF_PER_OBJECT) {
        break;
      }
      const entryIndex = node.value.indexOf(entryKey);
      indexToDisplayArray.push(entryIndex);
    }
    indexToDisplayArray.sort();
    return renderEntriesMultiline(node, props, { indexToDisplayArray });
  }
  if (node.comparisonDiffMap.size > 0) {
    const indexToDisplayArray = [];
    index_to_display: {
      const entryKeys = node.value;
      if (entryKeys.length === 0) {
        break index_to_display;
      }
      const diffIndexArray = [];
      for (const [entryKey] of node.comparisonDiffMap) {
        const entryIndex = entryKeys.indexOf(entryKey);
        if (entryIndex === -1) {
          // happens when removed/added
        } else {
          diffIndexArray.push(entryIndex);
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
        if (diffCount >= props.MAX_DIFF_PER_OBJECT) {
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
        while (afterDiffIndex < entryKeys.length) {
          if (afterCount === props.MAX_ENTRY_AFTER_MULTILINE_DIFF) {
            break;
          }
          indexToDisplaySet.add(afterDiffIndex);
          afterCount++;
          afterDiffIndex--;
        }
      }
      for (const indexToDisplay of indexToDisplaySet) {
        indexToDisplayArray.push(indexToDisplay);
      }
      indexToDisplayArray.sort();
    }
    return renderEntriesMultiline(node, props, { indexToDisplayArray });
  }
  if (node.isCompatibleWithSingleLineDiff) {
    return renderEntriesWithoutDiffOneLiner(node, props);
  }
  return renderEntriesMultiline(node, props, {
    indexToDisplayArray: [0],
  });
};
const getNodeDepth = (node, props) => {
  return node.depth - props.startNode.depth;
};

const renderEntriesOneLiner = (node, props) => {
  node.hasIndentBeforeEntries = false;
  let columnsRemaining = props.columnsRemaining;
  let focusedEntryIndex = -1; // TODO: take first one with a diff
  const entryKeys = node.value;
  const { startMarker, endMarker } = node;
  const { overflowStartMarker, overflowEndMarker } = node;
  // columnsRemaining -= overflowStartMarker;
  // columnsRemaining -= overflowEndMarker;
  columnsRemaining -= startMarker.length;
  columnsRemaining -= endMarker.length;

  let focusedEntryKey = entryKeys[focusedEntryIndex];
  if (!focusedEntryKey) {
    focusedEntryIndex = entryKeys.length - 1;
    focusedEntryKey = entryKeys[focusedEntryIndex];
  }
  const focusedEntry = node.childNodeMap.get(focusedEntryKey);
  let focusedEntryDiff = "";
  if (focusedEntry) {
    if (entryKeys.length === 1) {
      // TODO: ideally something better as in oneLinerWithoutDiff
      // where we restore endMarker + append it when we got
      // many
      focusedEntry.endMarker = "";
    }
    focusedEntryDiff = focusedEntry.render(props);
    columnsRemaining -= stringWidth(focusedEntryDiff);
  }

  const overflowStartWidth = overflowStartMarker.length;
  const overflowEndWidth = overflowEndMarker.length;
  let tryBeforeFirst = true;
  let previousChildAttempt = 0;
  let nextChildAttempt = 0;
  const beforeDiffArray = [];
  const afterDiffArray = [];
  let hasStartOverflow;
  let hasEndOverflow;
  while (columnsRemaining) {
    const previousEntryIndex = focusedEntryIndex - previousChildAttempt - 1;
    const nextEntryIndex = focusedEntryIndex + nextChildAttempt + 1;
    let hasPreviousEntry = previousEntryIndex >= 0;
    const hasNextEntry = nextEntryIndex < entryKeys.length;
    if (!hasPreviousEntry && !hasNextEntry) {
      break;
    }
    if (!tryBeforeFirst && hasNextEntry) {
      hasPreviousEntry = false;
    }
    let entryIndex;
    if (hasPreviousEntry) {
      previousChildAttempt++;
      entryIndex = previousEntryIndex;
    } else if (hasNextEntry) {
      nextChildAttempt++;
      entryIndex = nextEntryIndex;
    }
    const entryKey = entryKeys[entryIndex];
    const entryNode = node.childNodeMap.get(entryKey);
    if (!entryNode) {
      debugger; // to keep to see if that is hit while running all of string.test.js
      // if not remove it
      continue;
    }
    if (tryBeforeFirst && hasPreviousEntry) {
      tryBeforeFirst = false;
    }
    const entryDiff = entryNode.render(props);
    const entryDiffWidth = measureLastLineColumns(entryDiff);
    let nextWidth = entryDiffWidth;
    hasStartOverflow = focusedEntryIndex - previousChildAttempt > 0;
    hasEndOverflow =
      focusedEntryIndex + nextChildAttempt < entryKeys.length - 1;
    if (hasStartOverflow) {
      nextWidth += overflowStartWidth;
    }
    if (hasEndOverflow) {
      nextWidth += overflowEndWidth;
    }
    if (nextWidth > columnsRemaining) {
      if (hasPreviousEntry) {
        previousChildAttempt--;
      } else {
        nextChildAttempt--;
      }
      break;
    }
    columnsRemaining -= entryDiffWidth;
    if (entryIndex < focusedEntryIndex) {
      beforeDiffArray.push(entryDiff);
    } else {
      afterDiffArray.push(entryDiff);
    }
  }
  let diff = "";
  if (hasStartOverflow) {
    diff += setColor(overflowStartMarker, node.color);
  }
  if (startMarker) {
    diff += setColor(startMarker, node.color);
  }
  diff += beforeDiffArray.reverse().join("");
  diff += focusedEntryDiff;
  diff += afterDiffArray.join("");
  if (endMarker) {
    diff += setColor(endMarker, node.color);
  }
  if (hasEndOverflow) {
    diff += setColor(overflowEndMarker, node.color);
  }
  return diff;
};
const renderEntriesWithoutDiffOneLiner = (node, props) => {
  const { startMarker, endMarker } = node;
  const entryKeys = node.value;
  let columnsRemaining = props.columnsRemaining;
  let boilerplate = `${startMarker} ... ${endMarker}`;
  columnsRemaining -= boilerplate.length;
  let diff = "";
  let entriesDiff = "";
  let lastEntryDisplayed = null;
  node.hasIndentBeforeEntries = false;
  for (const entryKey of entryKeys) {
    const entryNode = node.childNodeMap.get(entryKey);
    const entryNodeEndMarker = entryNode.endMarker;
    entryNode.endMarker = "";
    const entryDiff = entryNode.render({
      ...props,
      columnsRemaining,
    });
    entryNode.endMarker = entryNodeEndMarker;
    const entryDiffWidth = measureLastLineColumns(entryDiff);
    if (entryDiffWidth > columnsRemaining) {
      if (lastEntryDisplayed) {
        diff += setColor(startMarker, node.color);
        diff += entriesDiff;
        diff += setColor(
          node.hasSpacingAroundEntries
            ? ` ... ${endMarker}`
            : ` ...${endMarker}`,
          node.color,
        );
        return diff;
      }
      diff += setColor(
        node.hasSpacingAroundEntries
          ? `${startMarker} ... ${endMarker}`
          : `${startMarker}...${endMarker}`,
        node.color,
      );
      return diff;
    }
    if (lastEntryDisplayed) {
      entriesDiff += setColor(
        lastEntryDisplayed.endMarker,
        lastEntryDisplayed.color,
      );
      entriesDiff += " ";
    }
    lastEntryDisplayed = entryNode;
    entriesDiff += entryDiff;
    columnsRemaining -= entryDiffWidth;
  }
  if (!lastEntryDisplayed) {
    if (node.hasMarkersWhenEmpty) {
      return setColor(`${startMarker}${endMarker}`, node.color);
    }
    return "";
  }
  diff += setColor(startMarker, node.color);
  if (node.hasSpacingAroundEntries) {
    diff += " ";
  }
  diff += entriesDiff;
  if (node.hasSpacingAroundEntries) {
    diff += " ";
  }
  diff += setColor(endMarker, node.color);
  return diff;
};
const renderEntriesMultiline = (node, props, { indexToDisplayArray }) => {
  const entryKeys = node.value;
  const { startMarker, endMarker } = node;
  let atLeastOneEntryDisplayed = null;
  let diff = "";
  let entriesDiff = "";
  const appendEntry = (entryDiff) => {
    if (atLeastOneEntryDisplayed) {
      entriesDiff += "\n";
      entriesDiff += entryDiff;
    } else {
      entriesDiff += entryDiff;
      atLeastOneEntryDisplayed = true;
    }
  };
  const appendSkippedEntries = (skipCount, skipPosition) => {
    let skippedDiff = "";
    if (node.hasIndentBeforeEntries) {
      skippedDiff += "  ".repeat(getNodeDepth(node, props) + 1);
    }
    if (node.skippedEntrySummary) {
      const { skippedEntryNames } = node.skippedEntrySummary;
      const sign = { start: "↑", between: "↕", end: `↓` }[skipPosition];
      skippedDiff += setColor(sign, node.color);
      skippedDiff += " ";
      skippedDiff += setColor(String(skipCount), node.color);
      skippedDiff += " ";
      skippedDiff += setColor(
        skippedEntryNames[skipCount === 1 ? 0 : 1],
        node.color,
      );
      skippedDiff += " ";
      skippedDiff += setColor(sign, node.color);
      appendEntry(skippedDiff);
      return;
    }
  };
  let previousIndexDisplayed = -1;
  let canResetMaxColumns = node.hasNewLineAroundEntries;
  for (const indexToDisplay of indexToDisplayArray) {
    if (previousIndexDisplayed === -1) {
      if (indexToDisplay > 0) {
        appendSkippedEntries(indexToDisplay, "start");
      }
    } else {
      const intermediateSkippedCount =
        indexToDisplay - previousIndexDisplayed - 1;
      if (intermediateSkippedCount) {
        appendSkippedEntries(intermediateSkippedCount, "between");
      }
    }
    const entryKey = entryKeys[indexToDisplay];
    const entryNode = node.childNodeMap.get(entryKey);
    if (!node.hasTrailingSeparator && indexToDisplay === entryKeys.length - 1) {
      entryNode.endMarker = "";
    }
    const entryDiff = entryNode.render({
      ...props,
      columnsRemaining: canResetMaxColumns
        ? props.MAX_COLUMNS
        : props.columnsRemaining,
    });
    canResetMaxColumns = true; // because we'll append \n on next entry
    appendEntry(entryDiff);
    previousIndexDisplayed = indexToDisplay;
  }
  const lastIndexDisplayed = previousIndexDisplayed;
  if (lastIndexDisplayed > -1) {
    const lastSkippedCount = entryKeys.length - 1 - lastIndexDisplayed;
    if (lastSkippedCount) {
      appendSkippedEntries(lastSkippedCount, "end");
    }
  }
  if (!atLeastOneEntryDisplayed) {
    if (node.hasMarkersWhenEmpty) {
      return setColor(`${startMarker}${endMarker}`, node.color);
    }
    return "";
  }
  diff += setColor(startMarker, node.color);
  if (node.hasNewLineAroundEntries) {
    diff += "\n";
  }
  diff += entriesDiff;
  if (node.hasNewLineAroundEntries) {
    diff += "\n";
    diff += "  ".repeat(getNodeDepth(node, props));
  }
  diff += setColor(endMarker, node.color);
  return diff;
};
const renderEntry = (node, props) => {
  const hasIndentBeforeEntries = node.parent.hasIndentBeforeEntries;
  const { endMarker } = node;
  let entryDiff = "";
  let columnsRemaining = props.columnsRemaining;
  if (hasIndentBeforeEntries) {
    const indent = "  ".repeat(getNodeDepth(node, props) + 1);
    columnsRemaining -= stringWidth(indent);
    entryDiff += indent;
  }
  const entryKeyNode = node.childNodeMap.get("entry_key");
  if (endMarker) {
    columnsRemaining -= endMarker.length;
  }
  let columnsRemainingForValue = columnsRemaining;

  const staticKeywordNode = node.childNodeMap.get("static_keyword");
  if (staticKeywordNode && !staticKeywordNode.isHidden) {
    const staticKeywordDiff = staticKeywordNode.render({
      ...props,
      columnsRemaining,
    });
    columnsRemaining -= measureLastLineColumns(staticKeywordDiff);
    columnsRemaining -= " ".length;
    entryDiff += staticKeywordDiff;
    entryDiff += " ";
  }
  if (!entryKeyNode.isHidden) {
    const entryKeyDiff = entryKeyNode.render({
      ...props,
      columnsRemaining,
    });
    columnsRemainingForValue -= measureLastLineColumns(entryKeyDiff);
    entryDiff += entryKeyDiff;
    const { middleMarker } = node;
    if (columnsRemainingForValue > middleMarker.length) {
      columnsRemainingForValue -= middleMarker.length;
      entryDiff += setColor(middleMarker, node.color);
    } else {
      columnsRemainingForValue = 0;
    }
  }
  if (columnsRemainingForValue > 0) {
    const entryValueNode = node.childNodeMap.get("entry_value");
    entryDiff += entryValueNode.render({
      ...props,
      columnsRemaining: columnsRemainingForValue,
    });
    if (endMarker) {
      entryDiff += setColor(endMarker, node.color);
    }
  } else if (endMarker) {
    entryDiff += setColor(endMarker, node.color);
  }
  return entryDiff;
};

const createMethodCallNode = (node, { objectName, methodName, args }) => {
  return {
    render: (node, props) => {
      let diff = "";
      const objectNameNode = node.childNodeMap.get("object_name");
      diff += objectNameNode.render(props);
      const methodDotNode = node.childNodeMap.get("method_dot");
      diff += methodDotNode.render(props);
      const methodNameNode = node.childNodeMap.get("method_name");
      diff += methodNameNode.render(props);
      const methodCallNode = node.childNodeMap.get("method_call");
      diff += methodCallNode.render(props);
      return diff;
    },
    group: "entries",
    subgroup: "method_call",
    childGenerator: (methodCallNode) => {
      methodCallNode.appendChild("object_name", {
        render: renderGrammar,
        group: "grammar",
        subgroup: "method_call_object_name",
        value: objectName,
      });
      methodCallNode.appendChild("method_dot", {
        render: renderGrammar,
        group: "grammar",
        subgroup: "method_call_dot",
        value: ".",
      });
      methodCallNode.appendChild("method_name", {
        render: renderGrammar,
        group: "grammar",
        subgroup: "method_call_method_name",
        value: methodName,
      });
      methodCallNode.appendChild(
        "method_call",
        createFunctionCallNode(methodCallNode, { args }),
      );
    },
  };
};

const createFunctionCallNode = (node, { args }) => {
  return {
    render: renderEntries,
    group: "entries",
    subgroup: "function_call",
    value: [],
    isCompatibleWithMultilineDiff: true,
    isCompatibleWithSingleLineDiff: true,
    hasNewLineAroundEntries: true,
    hasIndentBeforeEntries: true,
    startMarker: "(",
    endMarker: ")",
    childGenerator: (functionCallNode) => {
      const appendArgEntry = (
        argIndex,
        argValue,
        { key, isValueOfReturnValue },
      ) => {
        functionCallNode.value.push(argIndex);
        const argEntryNode = functionCallNode.appendChild(argIndex, {
          render: renderEntry,
          group: "entry",
          subgroup: "function_call_arg_entry",
          endMarker: ",",
        });
        argEntryNode.appendChild("entry_key", {
          render: renderInteger,
          group: "entry_key",
          subgroup: "function_call_arg_entry_key",
          value: argIndex,
          isHidden: true,
        });
        argEntryNode.appendChild("entry_value", {
          render: renderValue,
          group: "entry_value",
          subgroup: "function_call_arg_entry_value",
          value: argValue,
          path: node.path.append(key || argIndex),
          depth: node.depth,
          isValueOfReturnValue,
        });
      };
      let argIndex = 0;
      for (const { value, key, isValueOfReturnValue } of args) {
        appendArgEntry(argIndex, value, {
          key,
          isValueOfReturnValue,
        });
        argIndex++;
      }
    },
  };
};

const DOUBLE_QUOTE = `"`;
const SINGLE_QUOTE = `'`;
const BACKTICK = "`";

const getAddedOrRemovedReason = (node) => {
  if (node.group === "entry") {
    return getAddedOrRemovedReason(node.childNodeMap.get("entry_key"));
  }
  if (node.group === "entry_key") {
    return node.value;
  }
  if (node.group === "entry_value") {
    return getAddedOrRemovedReason(node.parent);
  }
  if (node.subgroup === "value_of_return_value") {
    return "value_of_own_method";
  }
  return "unknown";
};

const getWrappedNode = (node, predicate) => {
  for (const wrappedNodeGetter of node.wrappedNodeGetterSet) {
    const wrappedNode = wrappedNodeGetter();
    if (!wrappedNode) {
      continue;
    }
    if (predicate(wrappedNode)) {
      return wrappedNode;
    }
    // can happen for
    // valueOf: () => {
    //   return { valueOf: () => 10 }
    // }
    const nested = wrappedNode.getWrappedNode(node, predicate);
    if (nested) {
      return nested;
    }
  }
  return null;
};
// const asCompositeNode = (node) =>
//   getWrappedNode(
//     node,
//     (wrappedNodeCandidate) => wrappedNodeCandidate.isComposite,
//   );
const asPrimitiveNode = (node) =>
  getWrappedNode(
    node,
    (wrappedNodeCandidate) => wrappedNodeCandidate.isPrimitive,
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
    const prototypeValueIsComposite = typeof prototypeValue === "object";
    if (!prototypeValueIsComposite) {
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
