/*
 * LE PLUS DUR QU'IL FAUT FAIRE AVANT TOUT:
 *
 * - functions
 * - strings avec mutiline
 * - no need to break loop when max diff is reached
 *   en fait si pour string par exemple on voudra s'arreter
 *   mais pour un objet, un array un buffer on parcourira tout
 *   parce que on le fait de toute façon lorsqu'il n'y a pas de diff
 *   aussi ici du coup lorsque les props sont skipped
 *   le résumé doit etre de la bonne couleur en fonction de ce qui se passe dedans
 * - url string and url object
 * - well known
 * - property descriptors
 * - valueOf dans le constructor call QUE si subtype pas object
 *   sinon on le met comme une prop
 * - prototype
 *
 */

import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isValidPropertyIdentifier } from "./property_identifier.js";
import { createValuePath } from "./value_path.js";
import { getObjectType, visitObjectPrototypes } from "./object_type.js";
import {
  analyseFunction,
  defaultFunctionAnalysis,
} from "./function_analysis.js";

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

const setColor = (text, color) => {
  if (text.trim() === "") {
    // cannot set color of blank chars
    return text;
  }
  return ANSI.color(text, color);
};
const measureLastLineColumns = (string) => {
  if (string.includes("\n")) {
    const lines = string.split("\n");
    const lastLine = lines[lines.length - 1];
    return stringWidth(lastLine);
  }
  return stringWidth(string);
};

export const assert = ({
  actual,
  expect,
  MAX_PROP_BEFORE_DIFF = 2,
  MAX_PROP_AFTER_DIFF = 2,
  MAX_DEPTH = 5,
  MAX_DEPTH_INSIDE_DIFF = 1,
  MAX_DIFF_PER_OBJECT = 2,
  MAX_COLUMNS = 100,
}) => {
  const rootActualNode = createRootNode({
    colorWhenSolo: addedColor,
    colorWhenSame: sameColor,
    colorWhenModified: unexpectColor,
    name: "actual",
    type: "root",
    value: actual,
    otherValue: expect,
  });
  const rootExpectNode = createRootNode({
    colorWhenSolo: removedColor,
    colorWhenSame: sameColor,
    colorWhenModified: expectColor,
    name: "expect",
    type: "root",
    value: expect,
    otherValue: actual,
  });

  const causeSet = new Set();
  let startActualNode = rootActualNode;
  let startExpectNode = rootExpectNode;
  const getNodeDepth = (node) => {
    if (node.name === "actual") {
      return node.depth - startActualNode.depth;
    }
    return node.depth - startExpectNode.depth;
  };

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
  const compare = (actualNode, expectNode) => {
    const reasons = createReasons();
    const comparison = {
      isComparison: true,
      actualNode,
      expectNode,
      depth: actualNode.depth || expectNode.depth,
      isContainer: actualNode.isContainer || expectNode.isContainer,
      parent: null,
      reasons,
      done: false,
    };

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
    const renderPrimitive = (node, { columnsRemaining }) => {
      let diff = "";
      if (columnsRemaining < 2) {
        diff = setColor("…", node.color);
        return diff;
      }
      let valueDiff;
      if (node.isSourceCode) {
        valueDiff = "[source code]";
      } else if (node.isString) {
        valueDiff = JSON.stringify(node.value);
        if (!node.useQuotes) {
          valueDiff = valueDiff.slice(1, -1);
        }
      } else if (node.isFunction) {
        valueDiff = "function";
      } else if (node.isUndefined) {
        valueDiff = "undefined";
      } else {
        valueDiff = JSON.stringify(node.value);
      }
      if (valueDiff.length > columnsRemaining) {
        diff += setColor(valueDiff.slice(0, columnsRemaining - 1), node.color);
        diff += setColor("…", node.color);
      } else {
        diff += setColor(valueDiff, node.color);
      }
      return diff;
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
      if (node.diffType) {
        if (typeof props.firstDiffDepth === "number") {
          maxDepthReached =
            node.depth + props.firstDiffDepth > MAX_DEPTH_INSIDE_DIFF;
        } else {
          props.firstDiffDepth = node.depth;
          maxDepthReached = node.depth > MAX_DEPTH_INSIDE_DIFF;
        }
      } else {
        maxDepthReached = node.depth > MAX_DEPTH;
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
        const objectTypeNode = node.childNodeMap.get("object_type");
        if (objectTypeNode) {
          const objectTypeDiff = objectTypeNode.render(props);
          columnsRemaining -= measureLastLineColumns(objectTypeDiff);
          diff += objectTypeDiff;
        }
        const constructorCallNode = node.childNodeMap.get("constructor_call");
        if (constructorCallNode) {
          if (diff) {
            columnsRemaining -= " ".length;
            diff += " ";
          }
          columnsRemaining -= "()".length;
          const firstArgNode = constructorCallNode.childNodeMap.get("0");
          const firstArgDiff = firstArgNode.render({
            ...props,
            columnsRemaining,
          });
          columnsRemaining -= measureLastLineColumns(firstArgDiff);
          diff += setColor("(", node.color);
          diff += firstArgDiff;
          diff += setColor(")", node.color);
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
        const asyncKeywordNode = node.childNodeMap.get(
          "function_async_keyword",
        );
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
      const classExtendedNameNode = node.childNodeMap.get(
        "class_extended_name",
      );
      if (classExtendedNameNode) {
        const classExtendsKeywordNode = node.childNodeMap.get(
          "class_extends_keyword",
        );
        diff += " ";
        diff += classExtendsKeywordNode.render(props);
        diff += " ";
        diff += classExtendedNameNode.render(props);
      }
      const functionBodyPrefixNode = node.childNodeMap.get(
        "function_body_prefix",
      );
      if (functionBodyPrefixNode) {
        if (diff) {
          diff += " ";
        }
        diff += functionBodyPrefixNode.render(props);
      }
      return diff;
    };

    const renderEntryArrayOneLiner = (node, props) => {
      const { startSeparator, endSeparator } = node;

      const entryKeys = node.value;
      if (entryKeys.length === 0) {
        if (node.hideSeparatorsWhenEmpty) {
          return "";
        }
        return setColor(`${startSeparator}${endSeparator}`, node.color);
      }
      let columnsRemaining = props.columnsRemaining;
      let boilerplate = `${startSeparator} ... ${endSeparator}`;
      columnsRemaining -= boilerplate.length;
      let diff = "";
      let entriesDiff = "";
      let lastEntryDisplayed = null;
      for (const entryKey of entryKeys) {
        const entryNode = node.childNodeMap.get(entryKey);
        const entryEndSeparator = entryNode.endSeparator;
        entryNode.endSeparator = "";
        const entryDiff = entryNode.render({
          ...props,
          columnsRemaining,
        });
        entryNode.endSeparator = entryEndSeparator;
        const entryDiffWidth = measureLastLineColumns(entryDiff);
        if (entryDiffWidth > columnsRemaining) {
          if (lastEntryDisplayed) {
            diff += setColor(startSeparator, node.color);
            diff += entriesDiff;
            diff += setColor(` ... ${endSeparator}`, node.color);
            return diff;
          }
          diff += setColor(`${startSeparator} ... ${endSeparator}`, node.color);
          return diff;
        }
        if (lastEntryDisplayed) {
          entriesDiff += setColor(
            lastEntryDisplayed.endSeparator,
            lastEntryDisplayed.color,
          );
          entriesDiff += " ";
        }
        lastEntryDisplayed = entryNode;
        entriesDiff += entryDiff;
        columnsRemaining -= entryDiffWidth;
      }
      diff += setColor(startSeparator, node.color);
      if (node.entriesSpacing) {
        diff += " ";
      }
      diff += entriesDiff;
      if (node.entriesSpacing) {
        diff += " ";
      }
      diff += setColor(endSeparator, node.color);
      return diff;
    };
    const renderEntryArrayMultiline = (
      node,
      props,
      { indexToDisplayArray },
    ) => {
      if (!props) {
        debugger;
      }
      let atLeastOneEntryDisplayed = false;
      let diff = "";
      let entriesDiff = "";
      const entryKeys = node.value;
      const appendEntry = (entryDiff) => {
        if (atLeastOneEntryDisplayed) {
          entriesDiff += "\n";
          entriesDiff += entryDiff;
        } else {
          entriesDiff += entryDiff;
          atLeastOneEntryDisplayed = true;
        }
      };
      const appendSkippedEntries = (skipCount, sign) => {
        let skippedDiff = "";
        skippedDiff += "  ".repeat(getNodeDepth(node) + 1);
        skippedDiff += setColor(sign, node.color);
        skippedDiff += " ";
        skippedDiff += setColor(String(skipCount), node.color);
        skippedDiff += " ";
        const valueNames =
          node.type === "internal_entries"
            ? ["value", "values"]
            : ["prop", "props"];
        skippedDiff += setColor(
          skipCount === 1 ? valueNames[0] : valueNames[1],
          node.color,
        );
        skippedDiff += " ";
        skippedDiff += setColor(sign, node.color);
        appendEntry(skippedDiff);
      };
      let previousIndexDisplayed = -1;
      for (const indexToDisplay of indexToDisplayArray) {
        if (previousIndexDisplayed === -1) {
          if (indexToDisplay > 0) {
            appendSkippedEntries(indexToDisplay, "↑");
          }
        } else {
          const intermediateSkippedCount =
            indexToDisplay - previousIndexDisplayed - 1;
          if (intermediateSkippedCount) {
            appendSkippedEntries(intermediateSkippedCount, "↕");
          }
        }
        const entryKey = entryKeys[indexToDisplay];
        const entryNode = node.childNodeMap.get(entryKey);
        let entryDiff = "";
        entryDiff += "  ".repeat(getNodeDepth(entryNode) + 1);
        entryDiff += entryNode.render({
          ...props,
          // reset remaining width
          columnsRemaining: MAX_COLUMNS - entryDiff.length,
        });
        appendEntry(entryDiff);
        previousIndexDisplayed = indexToDisplay;
      }
      const lastIndexDisplayed = previousIndexDisplayed;
      if (lastIndexDisplayed > -1) {
        const lastSkippedCount = entryKeys.length - 1 - lastIndexDisplayed;
        if (lastSkippedCount) {
          appendSkippedEntries(lastSkippedCount, `↓`);
        }
      }
      const { startSeparator, endSeparator } = node;
      if (atLeastOneEntryDisplayed) {
        diff += setColor(startSeparator, node.color);
        diff += "\n";
        diff += entriesDiff;
        diff += "\n";
        diff += "  ".repeat(getNodeDepth(node));
        diff += setColor(endSeparator, node.color);
      } else if (node.hideSeparatorsWhenEmpty) {
      } else {
        diff += setColor(startSeparator, node.color);
        diff += setColor(endSeparator, node.color);
      }
      return diff;
    };
    const renderEntry = (node, props) => {
      const { endSeparator } = node;
      let entryDiff = "";
      let columnsRemaining = props.columnsRemaining;
      const entryKeyNode = node.childNodeMap.get("entry_key");
      if (endSeparator) {
        columnsRemaining -= endSeparator.length;
      }
      let columnsRemainingForValue = columnsRemaining;
      if (!entryKeyNode.hidden) {
        const entryNameDiff = entryKeyNode.render({
          ...props,
          columnsRemaining,
        });
        columnsRemainingForValue -= measureLastLineColumns(entryNameDiff);
        entryDiff += entryNameDiff;
        const { middleSeparator } = node;
        if (columnsRemainingForValue > middleSeparator.length) {
          columnsRemainingForValue -= middleSeparator.length;
          entryDiff += setColor(middleSeparator, node.color);
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
        if (endSeparator) {
          entryDiff += setColor(endSeparator, node.color);
        }
      } else if (endSeparator) {
        entryDiff += setColor(endSeparator, node.color);
      }
      return entryDiff;
    };
    const getIndexToDisplayArrayDuo = (node, comparisonDiffMap) => {
      if (comparisonDiffMap.size === 0) {
        return [];
      }
      const entryKeys = node.value;
      if (entryKeys.length === 0) {
        return [];
      }
      const diffIndexArray = [];
      for (const [entryKey] of comparisonDiffMap) {
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
        return [0];
      }
      diffIndexArray.sort();
      const indexToDisplaySet = new Set();
      let diffCount = 0;
      for (const diffIndex of diffIndexArray) {
        if (diffCount >= MAX_DIFF_PER_OBJECT) {
          break;
        }
        diffCount++;
        let beforeDiffIndex = diffIndex - 1;
        let beforeCount = 0;
        while (beforeDiffIndex > -1) {
          if (beforeCount === MAX_PROP_BEFORE_DIFF) {
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
          if (afterCount === MAX_PROP_AFTER_DIFF) {
            break;
          }
          indexToDisplaySet.add(afterDiffIndex);
          afterCount++;
          afterDiffIndex--;
        }
      }
      const indexToDisplayArray = Array.from(indexToDisplaySet);
      indexToDisplayArray.sort();
      return indexToDisplayArray;
    };
    const getIndexToDisplayArraySolo = (node, comparisonResultMap) => {
      const indexToDisplayArray = [];
      for (const [entryKey] of comparisonResultMap) {
        if (indexToDisplayArray.length >= MAX_DIFF_PER_OBJECT) {
          break;
        }
        const entryIndex = node.value.indexOf(entryKey);
        indexToDisplayArray.push(entryIndex);
      }
      indexToDisplayArray.sort();
      return indexToDisplayArray;
    };

    const subcompareDuo = (actualChildNode, expectChildNode) => {
      const childComparison = compare(actualChildNode, expectChildNode);
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
    const subcompareChilNodesDuo = () => {
      const isSetEntriesComparison =
        actualNode.type === "internal_entries" &&
        expectNode.type === "internal_entries" &&
        actualNode.parent.isSet &&
        expectNode.parent.isSet;
      const isSetEntryComparison =
        actualNode.type === "internal_entry" &&
        expectNode.type === "internal_entry" &&
        actualNode.parent.parent.isSet &&
        expectNode.parent.parent.isSet;

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
      return { comparisonResultMap, comparisonDiffMap };
    };
    const subcompareChildNodesSolo = (node, placeholderNode) => {
      const comparisonResultMap = new Map();
      for (const [childName, childNode] of node.childNodeMap) {
        const soloChildComparison = subcompareSolo(childNode, placeholderNode);
        comparisonResultMap.set(childName, soloChildComparison);
      }
      return comparisonResultMap;
    };

    const visitDuo = (actualNode, expectNode) => {
      if (actualNode.isPrimitive) {
        subcompareChilNodesDuo(actualNode, expectNode);
        // comparing primitives
        if (actualNode.value === expectNode.value) {
          // we already know there will be no diff
          // but for now we'll still visit the primitive constituents
        } else {
          onSelfDiff("primitive_value");
        }
        actualNode.render = (props) => renderPrimitive(actualNode, props);
        expectNode.render = (props) => renderPrimitive(expectNode, props);
        return;
      }
      if (actualNode.isComposite) {
        subcompareChilNodesDuo(actualNode, expectNode);
        actualNode.render = (props) => renderComposite(actualNode, props);
        expectNode.render = (props) => renderComposite(expectNode, props);
        return;
      }
      if (
        actualNode.type === "internal_entries" ||
        actualNode.type === "indexed_entries" ||
        actualNode.type === "property_entries"
      ) {
        if (
          actualNode.hideSeparatorsWhenEmpty !==
          expectNode.hideSeparatorsWhenEmpty
        ) {
          actualNode.hideSeparatorsWhenEmpty =
            expectNode.hideSeparatorsWhenEmpty = false;
        }
        const { comparisonDiffMap } = subcompareChilNodesDuo(
          actualNode,
          expectNode,
        );
        if (comparisonDiffMap.size === 0) {
          actualNode.render = (props) =>
            renderEntryArrayOneLiner(actualNode, props);
          expectNode.render = (props) =>
            renderEntryArrayOneLiner(expectNode, props);
          return;
        }
        actualNode.render = (props) =>
          renderEntryArrayMultiline(actualNode, props, {
            indexToDisplayArray: getIndexToDisplayArrayDuo(
              actualNode,
              comparisonDiffMap,
            ),
          });
        expectNode.render = (props) =>
          renderEntryArrayMultiline(expectNode, props, {
            indexToDisplayArray: getIndexToDisplayArrayDuo(
              expectNode,
              comparisonDiffMap,
            ),
          });
        return;
      }
      if (
        actualNode.type === "internal_entry" ||
        actualNode.type === "indexed_entry" ||
        actualNode.type === "property_entry"
      ) {
        subcompareChilNodesDuo(actualNode, expectNode);
        actualNode.render = (props) => renderEntry(actualNode, props);
        expectNode.render = (props) => renderEntry(expectNode, props);
        return;
      }
      if (actualNode.isContainer) {
        subcompareChilNodesDuo(actualNode, expectNode);
        return;
      }
      throw new Error("wtf");
    };
    const visitSolo = (node, placeholderNode) => {
      if (node.isPrimitive) {
        subcompareChildNodesSolo(node, placeholderNode);
        node.render = (props) => renderPrimitive(node, props);
        return;
      }
      if (node.isComposite) {
        subcompareChildNodesSolo(node, placeholderNode);
        node.render = (props) => renderComposite(node, props);
        return;
      }
      if (
        node.type === "internal_entries" ||
        node.type === "indexed_entries" ||
        node.type === "property_entries"
      ) {
        const comparisonResultMap = subcompareChildNodesSolo(
          node,
          placeholderNode,
        );
        node.render = (props) =>
          renderEntryArrayMultiline(node, props, {
            indexToDisplayArray: getIndexToDisplayArraySolo(
              node,
              comparisonResultMap,
            ),
          });
        return;
      }
      if (
        node.type === "internal_entry" ||
        node.type === "indexed_entry" ||
        node.type === "property_entry"
      ) {
        subcompareChildNodesSolo(node, placeholderNode);
        node.render = (props) => renderEntry(node, props);
        return;
      }
      if (node.isContainer) {
        subcompareChildNodesSolo(node, placeholderNode);
        return;
      }
      throw new Error("wtf");
    };

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
      // comparing containers
      if (actualNode.isContainer && expectNode.isContainer) {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      // primitive vs composite
      if (actualNode.isPrimitive && expectNode.isComposite) {
        onSelfDiff("should_be_composite");
        const expectAsPrimitiveNode = asPrimitiveNode(expectNode);
        if (expectAsPrimitiveNode) {
          visitDuo(actualNode, expectAsPrimitiveNode);
        } else {
          visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
        }
        visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
        break visit;
      }
      // composite vs primitive
      if (actualNode.isComposite && expectNode.isPrimitive) {
        onSelfDiff("should_be_primitive");
        visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
        const actualAsPrimitiveNode = asPrimitiveNode(actualNode);
        if (actualAsPrimitiveNode) {
          visitDuo(actualAsPrimitiveNode, expectNode);
        } else {
          visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
        }
        break visit;
      }
      if (expectNode.placeholder) {
        onAdded(getAddedOrRemovedReason(actualNode));
        visitSolo(actualNode, expectNode);
        break visit;
      }
      if (actualNode.placeholder) {
        onRemoved(getAddedOrRemovedReason(expectNode));
        visitSolo(expectNode, actualNode);
        break visit;
      }
      throw new Error("wtf");
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
        "solo": node.colorWhenSolo,
        "modified": node.colorWhenModified,
        "": node.colorWhenSame,
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
      actualNode.diffType = expectNode.diffType = "modified";
      updateColor(actualNode);
      updateColor(expectNode);
    } else {
      updateColor(actualNode);
      updateColor(expectNode);
    }
    return comparison;
  };

  const rootComparison = compare(rootActualNode, rootExpectNode);
  if (!rootComparison.hasAnyDiff) {
    return;
  }

  let diff = ``;
  const infos = [];

  start_on_max_depth: {
    if (rootComparison.selfHasModification) {
      break start_on_max_depth;
    }
    let topMostComparisonWithDiff = null;
    for (const comparisonWithDiff of causeSet) {
      if (
        !topMostComparisonWithDiff ||
        comparisonWithDiff.depth < topMostComparisonWithDiff.depth
      ) {
        topMostComparisonWithDiff = comparisonWithDiff;
      }
    }
    if (topMostComparisonWithDiff.depth < MAX_DEPTH) {
      break start_on_max_depth;
    }
    let currentComparison = topMostComparisonWithDiff;
    let startDepth = topMostComparisonWithDiff.depth - MAX_DEPTH;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const parentComparison = currentComparison.parent;
      if (parentComparison) {
        if (
          !parentComparison.isContainer &&
          parentComparison.depth === startDepth
        ) {
          startActualNode = parentComparison.actualNode;
          startExpectNode = parentComparison.expectNode;
          const path = startActualNode.path || startExpectNode.path;
          infos.push(`diff starts at ${ANSI.color(path, ANSI.YELLOW)}`);
          break;
        }
        currentComparison = parentComparison;
      } else {
        break;
      }
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
  diff += startActualNode.render({
    columnsRemaining: MAX_COLUMNS - "actual: ".length,
  });
  diff += `\n`;
  diff += ANSI.color("expect:", sameColor);
  diff += " ";
  diff += startExpectNode.render({
    columnsRemaining: MAX_COLUMNS - "expect: ".length,
  });
  throw diff;
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
    type,
    value,
  }) => {
    const rootNode = createNode({
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
      type,
      value,
      parent: null,
      depth: 0,
      path: createValuePath(),
      meta: {},
    });

    return rootNode;
  };

  const createNode = ({
    colorWhenSolo,
    colorWhenSame,
    colorWhenModified,
    name,
    type,
    value,
    parent,
    depth,
    path,
    isContainer,
    meta = {},
  }) => {
    const node = {
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
      type,
      value,
      parent,
      depth,
      path,
      isContainer,
      meta,
      childNodeMap: new Map(),
      appendChild: (
        name,
        {
          type,
          isContainer,
          value,
          depth = isContainer ? node.depth : node.depth + 1,
          path = node.path,
        },
      ) => {
        const childNode = createNode({
          colorWhenSolo: node.colorWhenSolo,
          colorWhenSame: node.colorWhenSame,
          colorWhenModified: node.colorWhenModified,
          name: node.name,
          type,
          value,
          parent: node,
          depth,
          path,
          isContainer,
        });
        node.childNodeMap.set(name, childNode);
        return childNode;
      },
      // info
      isPrimitive: false,
      isComposite: false,
      // info/primitive
      isUndefined: false,
      isString: false,
      isSourceCode: false,
      isNumber: false,
      isSymbol: false,
      // info/composite
      objectType: "",
      isFunction: false,
      functionAnalysis: defaultFunctionAnalysis,
      isArray: false,
      isMap: false,
      isSet: false,
      isFunctionPrototype: false,
      // render info
      render: () => {
        throw new Error(`render not implemented for ${type}`);
      },
      hidden: false,
      diffType: "",
      useQuotes: false,
      startSeparator: "",
      middleSeparator: "",
      endSeparator: "",
      entriesSpacing: false,
      hideSeparatorsWhenEmpty: false,
      color: "",
    };
    Object.preventExtensions(node);

    if (value === PLACEHOLDER_FOR_NOTHING) {
      return node;
    }
    if (value === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
      return node;
    }
    if (value === SOURCE_CODE_ENTRY_KEY) {
      node.isPrimitive = true;
      return node;
    }
    if (type === "internal_entries") {
      node.startSeparator = "(";
      node.endSeparator = ")";
      return node;
    }
    if (type === "indexed_entries") {
      node.startSeparator = "[";
      node.endSeparator = "]";
      return node;
    }
    if (type === "property_entries") {
      node.startSeparator = "{";
      node.endSeparator = "}";
      node.entriesSpacing = true;
      return node;
    }
    if (type === "internal_entry") {
      node.middleSeparator = " => ";
      node.endSeparator = ",";
      return node;
    }
    if (type === "indexed_entry") {
      node.endSeparator = ",";
      return node;
    }
    if (type === "property_entry") {
      node.middleSeparator = ": ";
      node.endSeparator = ",";
      return node;
    }
    if (type === "constructor_call") {
      node.startSeparator = "(";
      node.endSeparator = ")";
      return node;
    }
    if (isContainer) {
      return node;
    }
    if (type === "indexed_entry_key") {
      node.isPrimitive = true;
      node.isNumber = true;
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
      // object type
      if (isFunction) {
        node.isFunction = true;
        node.functionAnalysis = analyseFunction(value);
        // if (node.functionAnalysis.type === "arrow") {
        //   if (node.functionAnalysis.isAsync) {
        //     node.objectType = node.functionAnalysis.isGenerator
        //       ? "AsyncArrowFunction"
        //       : "ArrowFunction";
        //   } else {
        //     node.objectType = node.functionAnalysis.isGenerator
        //       ? "GeneratorArrowFunction"
        //       : "ArrowFunction";
        //   }
        // } else if (node.functionAnalysis.isAsync) {
        //   node.objectType = node.functionAnalysis.isGenerator
        //     ? "AsyncGeneratorFunction"
        //     : "AsyncFunction";
        // } else {
        //   node.objectType = node.functionAnalysis.isGenerator
        //     ? "GeneratorFunction"
        //     : "Function";
        // }

        if (node.functionAnalysis.type === "class") {
          node.appendChild("class_keyword", {
            type: "class_keyword",
            value: "class",
          });
          const extendedClassName = node.functionAnalysis.extendedClassName;
          if (extendedClassName) {
            node.appendChild("class_extends_keyword", {
              type: "class_extends_keyword",
              value: "extends",
            });
            node.appendChild("class_extended_name", {
              type: "class_extended_name",
              value: node.functionAnalysis.extendedClassName,
            });
          }
        }
        if (node.functionAnalysis.isAsync) {
          node.appendChild("function_async_keyword", {
            type: "function_async_keyword",
            value: "async",
          });
        }
        if (node.functionAnalysis.type === "classic") {
          node.appendChild("function_keyword", {
            type: "function_keyword",
            value: node.functionAnalysis.isGenerator ? "function*" : "function",
          });
        }
        if (node.functionAnalysis.name) {
          node.appendChild("function_name", {
            type: "function_name",
            value: node.functionAnalysis.name,
          });
        }
        if (node.functionAnalysis.type === "arrow") {
          node.appendChild("function_body_prefix", {
            type: "function_body_prefix",
            value: "() =>",
          });
        } else if (node.functionAnalysis.type === "method") {
          if (node.functionAnalysis.getterName) {
            node.appendChild("function_body_prefix", {
              type: "function_body_prefix",
              value: `get ${"toto"}()`, // TODO: should not be "toto" but the method name
              // that can be found in node parent(s)
            });
          } else if (node.functionAnalysis.setterName) {
            node.appendChild("function_body_prefix", {
              type: "function_body_prefix",
              value: `set ${"toto"}()`, // TODO: should not be "toto" but the method name
              // that can be found in node parent(s)
            });
          } else {
            node.appendChild("function_body_prefix", {
              type: "function_body_prefix",
              value: `${"toto"}()`, // TODO: should not be "toto" but the method name
              // that can be found in node parent(s)
            });
          }
        } else if (node.functionAnalysis.type === "classic") {
          node.appendChild("function_body_prefix", {
            type: "function_body_prefix",
            value: `()`,
          });
        }
      } else {
        node.objectType = getObjectType(value);
        node.isFunctionPrototype =
          type === "property_entry_value" &&
          parent.childNodeMap.get("entry_key").value === "prototype" &&
          parent.parent.parent.isFunction;
        if (
          node.objectType &&
          node.objectType !== "Object" &&
          node.objectType !== "Array" &&
          !node.isFunctionPrototype
        ) {
          appendObjectTypeNode(node, node.objectType);
        }
      }

      // valueOf()
      if (
        typeof value.valueOf === "function" &&
        value.valueOf !== Object.prototype.valueOf
      ) {
        const constructorCallNode = appendConstructorCallNode(node);
        const valueOfReturnValue = value.valueOf();
        constructorCallNode.appendChild("0", {
          type: "value_of_return_value",
          value: valueOfReturnValue,
          path: node.path.append("valueOf()"),
          depth: node.depth,
        });
      }
      const propertyNameToIgnoreSet = new Set();
      // internal and indexed entries
      visitObjectPrototypes(value, (proto) => {
        const parentConstructor = proto.constructor;
        if (!parentConstructor) {
          return;
        }
        if (parentConstructor.name === "Map") {
          node.isMap = true;
          const mapInternalEntriesNode = appendInternalEntriesNode(node);
          for (const [mapEntryKey, mapEntryValue] of value) {
            appendInternalEntryNode(mapInternalEntriesNode, {
              key: mapEntryKey,
              value: mapEntryValue,
            });
          }
          return;
        }
        if (parentConstructor.name === "Array") {
          node.isArray = true;
          const arrayIndexedEntriesNode = appendIndexedEntriesNode(node);
          let index = 0;
          while (index < value.length) {
            propertyNameToIgnoreSet.add(String(index));
            appendIndexedEntryNode(
              arrayIndexedEntriesNode,
              index,
              Object.hasOwn(value, index) ? value[index] : ARRAY_EMPTY_VALUE,
            );
            index++;
          }
          return;
        }
        if (parentConstructor.name === "Set") {
          node.isSet = true;
          const setInternalEntriesNode = appendInternalEntriesNode(node);
          let index = 0;
          for (const [setValue] of value) {
            appendInternalEntryNode(setInternalEntriesNode, {
              key: index,
              keyHidden: true,
              value: setValue,
            });
            index++;
          }
          return;
        }
      });
      // own properties
      const ownPropertyNames = Object.getOwnPropertyNames(value).filter(
        (ownPropertyName) => {
          return (
            !propertyNameToIgnoreSet.has(ownPropertyName) &&
            !shouldIgnoreOwnPropertyName(node, ownPropertyName)
          );
        },
      );
      const canHaveIndexedEntries = node.childNodeMap.has("indexed_entries");
      if (canHaveIndexedEntries && ownPropertyNames.length === 0) {
        // skip entirely property_entries
      } else {
        const propertyEntriesNode = appendPropertyEntriesNode(node);
        propertyEntriesNode.hideSeparatorsWhenEmpty =
          node.childNodeMap.has("object_type") ||
          node.childNodeMap.has("constructor_call") ||
          node.childNodeMap.has("internal_entries") ||
          canHaveIndexedEntries;
        for (const ownPropertyName of ownPropertyNames) {
          const ownPropertyValue = value[ownPropertyName];
          appendPropertyEntryNode(propertyEntriesNode, {
            key: ownPropertyName,
            value: ownPropertyValue,
          });
        }
        if (node.isFunction) {
          appendPropertyEntryNode(propertyEntriesNode, {
            key: SOURCE_CODE_ENTRY_KEY,
            keyHidden: true,
            value: node.functionAnalysis.argsAndBodySource,
            valueIsSourceCode: true,
          });
        }
      }

      return node;
    }

    node.isPrimitive = true;
    if (typeofResult === "string") {
      node.isString = true;
      if (
        type === "object_type" ||
        type === "function_async_keyword" ||
        type === "function_keyword" ||
        type === "function_name" ||
        type === "function_body_prefix" ||
        type === "class_keyword" ||
        type === "class_extends_keyword" ||
        type === "class_extended_name"
      ) {
        node.useQuotes = false;
      } else if (
        type === "property_entry_key" &&
        isValidPropertyIdentifier(value)
      ) {
        node.useQuotes = false;
      } else {
        node.useQuotes = true;
      }
    }
    if (value === undefined) {
      node.isUndefined = true;
    }

    return node;
  };
}

const getAddedOrRemovedReason = (node) => {
  if (
    node.type === "internal_entry" ||
    node.type === "indexed_entry" ||
    node.type === "property_entry"
  ) {
    return getAddedOrRemovedReason(node.childNodeMap.get("entry_key"));
  }
  if (
    node.type === "internal_entry_key" ||
    node.type === "indexed_entry_key" ||
    node.type === "property_entry_key"
  ) {
    return node.value;
  }
  if (
    node.type === "internal_entry_value" ||
    node.type === "indexed_entry_value" ||
    node.type === "property_entry_value"
  ) {
    return getAddedOrRemovedReason(node.parent);
  }
  if (node.type === "value_of_return_value") {
    return "value_of_own_method";
  }
  return "unknown";
};
const asPrimitiveNode = (node) => {
  const wrappedValueNode = node.childNodeMap.get("value_of_return_value");
  if (wrappedValueNode && wrappedValueNode.isPrimitive) {
    return wrappedValueNode;
  }
  return null;
};
const appendObjectTypeNode = (node, objectType) => {
  const objectTypeNode = node.appendChild("object_type", {
    type: "object_type",
    value: objectType,
    path: node.path.append("[[ObjectType]]"),
    depth: node.depth,
  });
  return objectTypeNode;
};
const appendConstructorCallNode = (node) => {
  return node.appendChild("constructor_call", {
    type: "constructor_call",
    isContainer: true,
    path: node.path,
    depth: node.depth,
  });
};

const appendInternalEntriesNode = (node) => {
  const internalEntriesNode = node.appendChild("internal_entries", {
    type: "internal_entries",
    isContainer: true,
    value: [],
  });
  return internalEntriesNode;
};
const appendInternalEntryNode = (node, { key, keyHidden, value }) => {
  node.value.push(key);
  const internalEntryNode = node.appendChild(key, {
    type: "internal_entry",
    isContainer: true,
    path: node.path.append(key),
  });
  const internalEntryKeyNode = internalEntryNode.appendChild("entry_key", {
    type: "internal_entry_key",
    value: key,
  });
  if (keyHidden) {
    internalEntryKeyNode.hidden = true;
  }
  internalEntryNode.appendChild("entry_value", {
    type: "internal_entry_value",
    value,
  });
  return internalEntryNode;
};
const appendIndexedEntriesNode = (node) => {
  const indexedEntriesNode = node.appendChild("indexed_entries", {
    type: "indexed_entries",
    isContainer: true,
    value: [],
  });
  return indexedEntriesNode;
};
const appendIndexedEntryNode = (node, index, value) => {
  node.value.push(index);
  const indexedEntryNode = node.appendChild(index, {
    type: "indexed_entry",
    isContainer: true,
    path: node.path.append(index, { isIndexedEntry: true }),
  });
  const indexedEntryKeyNode = indexedEntryNode.appendChild("entry_key", {
    type: "indexed_entry_key",
    value: index,
  });
  indexedEntryKeyNode.hidden = true;
  indexedEntryNode.appendChild("entry_value", {
    type: "indexed_entry_value",
    value,
  });
  return indexedEntryNode;
};
const appendPropertyEntriesNode = (node) => {
  const propertyEntriesNode = node.appendChild("property_entries", {
    type: "property_entries",
    isContainer: true,
    value: [],
  });
  return propertyEntriesNode;
};
const appendPropertyEntryNode = (
  node,
  { key, keyHidden, value, valueIsSourceCode },
) => {
  node.value.push(key);
  const propertyEntryNode = node.appendChild(key, {
    type: "property_entry",
    isContainer: true,
    path: node.path.append(key),
  });
  const propertyEntryKeyNode = propertyEntryNode.appendChild("entry_key", {
    type: "property_entry_key",
    value: key,
  });
  if (keyHidden) {
    propertyEntryKeyNode.hidden = true;
  }
  const propertyEntryValueNode = propertyEntryNode.appendChild("entry_value", {
    type: "property_entry_value",
    value,
  });
  if (valueIsSourceCode) {
    propertyEntryValueNode.isSourceCode = true;
  }
  return propertyEntryNode;
};

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
  if (ownPropertyName === "valueOf") {
    const constructorCallNode = node.childNodeMap.get("constructor_call");
    return constructorCallNode && constructorCallNode.childNodeMap.has("0");
  }
  if (ownPropertyName === "toString") {
    return false;
    // return (
    //   node.childNodes.wrappedValue &&
    //   node.childNodes.wrappedValue.key === "toString()"
    // );
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
