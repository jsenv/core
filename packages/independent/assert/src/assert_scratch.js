/*
 * LE PLUS DUR QU'IL FAUT FAIRE AVANT TOUT:
 *
 * - strings avec multiline
 *   souligne les chars ayant des diffs?
 *   ça aiderais a voir ou est le diff (évite de trop compter sur la couleur)
 * - no need to break loop when max diff is reached
 *   en fait si pour string par exemple on voudra s'arreter
 *   mais pour un objet, un array un buffer on parcourira tout
 *   parce que on le fait de toute façon lorsqu'il n'y a pas de diff
 *   aussi ici du coup lorsque les props sont skipped
 *   le résumé doit etre de la bonne couleur en fonction de ce qui se passe dedans
 * - url string and url object
 * - well known
 * - property descriptors
 * - errors
 * - prototype
 * - symbols
 * - numbers
 *
 */

import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isValidPropertyIdentifier } from "./property_identifier.js";
import { createValuePath } from "./value_path.js";
import { getObjectTag, visitObjectPrototypes } from "./object_tag.js";
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
  const compare = (actualNode, expectNode, parent = null) => {
    const reasons = createReasons();
    const comparison = {
      isComparison: true,
      actualNode,
      expectNode,
      depth: actualNode.depth || expectNode.depth,
      isContainer: actualNode.isContainer || expectNode.isContainer,
      parent,
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
    const renderPrimitive = (node, props) => {
      let diff = "";
      const { columnsRemaining } = props;
      if (columnsRemaining < 2) {
        diff = setColor("…", node.color);
        return diff;
      }
      let valueDiff;
      if (node.isSourceCode) {
        valueDiff = "[source code]";
      } else if (node.value === VALUE_OF_RETURN_VALUE_ENTRY_KEY) {
        valueDiff = "valueOf()";
      } else if (node.value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY) {
        valueDiff = "[Symbol.toPrimitive()]";
      } else if (node.isString) {
        const lineEntriesNode = node.childNodeMap.get("line_entries");
        if (lineEntriesNode) {
          return lineEntriesNode.render(props);
        }
        if (node.type === "char_entry_value") {
          const char = node.value;
          if (char === node.parent.parent.parent.parent.startMarker) {
            valueDiff = `\\${char}`;
          } else {
            const point = char.charCodeAt(0);
            if (point === 92 || point < 32 || (point > 126 && point < 160)) {
              valueDiff = CHAR_TO_ESCAPED_CHAR[point];
            } else {
              valueDiff = char;
            }
          }
        } else {
          valueDiff = JSON.stringify(node.value);
          if (!node.hasQuotes) {
            valueDiff = valueDiff.slice(1, -1);
          }
        }
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
        const objectTagNode = node.childNodeMap.get("object_tag");
        if (objectTagNode) {
          const objectTagDiff = objectTagNode.render(props);
          columnsRemaining -= measureLastLineColumns(objectTagDiff);
          diff += objectTagDiff;
        }
        const constructorCallNode = node.childNodeMap.get("constructor_call");
        if (constructorCallNode) {
          columnsRemaining -= "()".length;
          const firstArgNode = constructorCallNode.childNodeMap.get(0);
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
    const renderContainer = (node) => {
      throw new Error(`render container not implemented for ${node.type}`);
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

    const renderEntries = (node, props, { comparisonDiffMap, isSolo }) => {
      if (!node.isCompatibleWithMultilineDiff) {
        return renderEntriesOneLiner(node, props);
      }
      if (isSolo) {
        const indexToDisplayArray = getIndexToDisplayArraySolo(
          node,
          comparisonDiffMap,
        );
        return renderEntriesMultiline(node, props, { indexToDisplayArray });
      }
      if (comparisonDiffMap.size > 0) {
        const indexToDisplayArray = getIndexToDisplayArrayDuo(
          node,
          comparisonDiffMap,
        );
        return renderEntriesMultiline(node, props, { indexToDisplayArray });
      }
      if (!node.isCompatibleWithSingleLineDiff) {
        return renderEntriesMultiline(node, props, {
          indexToDisplayArray: [0],
        });
      }
      return renderEntriesWithoutDiffOneLiner(node, props);
    };
    const getIndexToDisplayArrayDuo = (node, comparisonDiffMap) => {
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
          if (beforeCount === MAX_ENTRY_BEFORE_MULTILINE_DIFF) {
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
          if (afterCount === MAX_ENTRY_AFTER_MULTILINE_DIFF) {
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
    const renderEntriesOneLiner = (node, props) => {
      let columnsRemaining = props.columnsRemaining;
      let focusedEntryIndex = -1; // TODO: take first one with a diff
      const entryKeys = node.value;
      const { startMarker, endMarker } = node;
      const { overflowStartMarker, overflowEndMarker } = node;
      // columnsRemaining -= overflowStartMarker;
      // columnsRemaining -= overflowEndMarker;
      columnsRemaining -= startMarker.length;
      columnsRemaining -= endMarker.length;

      let focusedEntry = entryKeys[focusedEntryIndex];
      if (!focusedEntry) {
        focusedEntryIndex = entryKeys.length - 1;
        focusedEntry = node.childNodeMap.get(entryKeys[focusedEntryIndex]);
      }
      let focusedEntryDiff = "";
      if (focusedEntry) {
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
          debugger;
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
          skippedDiff += "  ".repeat(getNodeDepth(node) + 1);
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
        const entryDiff = entryNode.render({
          ...props,
          columnsRemaining: canResetMaxColumns
            ? MAX_COLUMNS
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
        diff += "  ".repeat(getNodeDepth(node));
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
        const indent = "  ".repeat(getNodeDepth(node) + 1);
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
      return { comparisonDiffMap };
    };
    const subcompareChildNodesSolo = (node, placeholderNode) => {
      const comparisonDiffMap = new Map();
      for (const [childName, childNode] of node.childNodeMap) {
        const soloChildComparison = subcompareSolo(childNode, placeholderNode);
        comparisonDiffMap.set(childName, soloChildComparison);
      }
      return { comparisonDiffMap };
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
        actualNode.type === "property_entries" ||
        actualNode.type === "line_entries" ||
        actualNode.type === "char_entries"
      ) {
        if (actualNode.hasMarkersWhenEmpty !== expectNode.hasMarkersWhenEmpty) {
          actualNode.hasMarkersWhenEmpty =
            expectNode.hasMarkersWhenEmpty = true;
        }
        const { comparisonDiffMap } = subcompareChilNodesDuo(
          actualNode,
          expectNode,
        );
        actualNode.render = (props) =>
          renderEntries(actualNode, props, { comparisonDiffMap });
        expectNode.render = (props) =>
          renderEntries(expectNode, props, { comparisonDiffMap });
        return;
      }
      if (
        actualNode.type === "internal_entry" ||
        actualNode.type === "indexed_entry" ||
        actualNode.type === "property_entry" ||
        actualNode.type === "line_entry" ||
        actualNode.type === "char_entry"
      ) {
        subcompareChilNodesDuo(actualNode, expectNode);
        actualNode.render = (props) => renderEntry(actualNode, props);
        expectNode.render = (props) => renderEntry(expectNode, props);
        return;
      }
      if (actualNode.isContainer) {
        subcompareChilNodesDuo(actualNode, expectNode);
        actualNode.render = (props) => renderContainer(actualNode, props);
        expectNode.render = (props) => renderContainer(expectNode, props);
        return;
      }
      throw new Error(
        `visitDuo not implemented for "${actualNode.type}" node type`,
      );
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
        node.type === "property_entries" ||
        node.type === "line_entries" ||
        node.type === "char_entries"
      ) {
        const { comparisonDiffMap } = subcompareChildNodesSolo(
          node,
          placeholderNode,
        );
        node.render = (props) =>
          renderEntries(node, props, { comparisonDiffMap, isSolo: true });
        return;
      }
      if (
        node.type === "internal_entry" ||
        node.type === "indexed_entry" ||
        node.type === "property_entry" ||
        node.type === "line_entry" ||
        node.type === "char_entry"
      ) {
        subcompareChildNodesSolo(node, placeholderNode);
        node.render = (props) => renderEntry(node, props);
        return;
      }
      if (node.isContainer) {
        subcompareChildNodesSolo(node, placeholderNode);
        node.render = (props) => renderContainer(node, props);
        return;
      }
      throw new Error(`visitSolo not implemented for "${node.type}" node type`);
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
          actualSkipSettle = true;
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
        const actualAsPrimitiveNode = asPrimitiveNode(actualNode);
        if (actualAsPrimitiveNode) {
          expectSkipSettle = true;
          visitDuo(actualAsPrimitiveNode, expectNode);
        } else {
          visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
        }
        visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
        break visit;
      }
      if (expectNode.placeholder) {
        if (actualNode.isAsPrimitiveValue) {
          const otherNode = getOtherNodeHoldingSomething(
            actualNode,
            comparison,
          );
          if (otherNode && otherNode.isPrimitive) {
            expectNode = otherNode;
            break visit;
          }
        }
        onAdded(getAddedOrRemovedReason(actualNode));
        visitSolo(actualNode, expectNode);
        break visit;
      }
      if (actualNode.placeholder) {
        if (expectNode.isAsPrimitiveValue) {
          const otherNode = getOtherNodeHoldingSomething(
            expectNode,
            comparison,
          );
          if (otherNode && otherNode.isPrimitive) {
            actualNode = otherNode;

            break visit;
          }
        }
        onRemoved(getAddedOrRemovedReason(expectNode));
        visitSolo(expectNode, actualNode);
        break visit;
      }
      throw new Error(
        `compare not implemented for ${actualNode.type} and ${expectNode.type}`,
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
      if (!actualSkipSettle) {
        actualNode.diffType = "modified";
        updateColor(actualNode);
      }
      if (!expectSkipSettle) {
        expectNode.diffType = "modified";
        updateColor(expectNode);
      }
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
    isGrammar,
    isSourceCode = false,
    isFunctionPrototype = false,
    isClassPrototype = false,
    isClassStaticProperty = false,
    isAsPrimitiveValue = false,
    methodName = "",
    isHidden = false,
    hasMarkersWhenEmpty = false,
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
      isGrammar,
      isSourceCode,
      isClassPrototype,
      isAsPrimitiveValue,
      childNodeMap: new Map(),
      appendChild: (
        name,
        {
          isContainer,
          isGrammar,
          isSourceCode,
          isFunctionPrototype,
          isClassPrototype,
          isClassStaticProperty,
          isAsPrimitiveValue,
          methodName,
          isHidden,
          hasMarkersWhenEmpty,
          type,
          value,
          depth = isContainer ||
          isGrammar ||
          isClassPrototype ||
          parent.isClassPrototype
            ? node.depth
            : node.depth + 1,
          path = node.path,
        },
      ) => {
        const childNode = createNode({
          isContainer,
          isGrammar,
          isSourceCode,
          isFunctionPrototype,
          isClassPrototype,
          isClassStaticProperty,
          isAsPrimitiveValue,
          methodName,
          isHidden,
          hasMarkersWhenEmpty,
          colorWhenSolo: node.colorWhenSolo,
          colorWhenSame: node.colorWhenSame,
          colorWhenModified: node.colorWhenModified,
          name: node.name,
          type,
          value,
          parent: node,
          depth,
          path,
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
      isNumber: false,
      isSymbol: false,
      // info/composite
      isFunction: false,
      functionAnalysis: defaultFunctionAnalysis,
      isArray: false,
      isMap: false,
      isSet: false,
      // render info
      render: () => {
        throw new Error(`render not implemented for ${type}`);
      },
      methodName,
      isHidden,
      diffType: "",
      hasQuotes: false,
      startMarker: "",
      middleMarker: "",
      endMarker: "",
      overflowStartMarker: "",
      overflowEndMarker: "",
      isCompatibleWithMultilineDiff: false,
      isCompatibleWithSingleLineDiff: false,
      skippedEntrySummary: null,
      hasSpacingAroundEntries: false,
      hasNewLineAroundEntries: false,
      hasIndentBeforeEntries: false,
      hasMarkersWhenEmpty,
      color: "",
    };
    Object.preventExtensions(node);

    if (value === PLACEHOLDER_FOR_NOTHING) {
      return node;
    }
    if (value === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
      return node;
    }
    if (
      value === SOURCE_CODE_ENTRY_KEY ||
      value === VALUE_OF_RETURN_VALUE_ENTRY_KEY ||
      value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY
    ) {
      node.isPrimitive = true;
      return node;
    }
    if (type === "internal_entries") {
      node.startMarker = "(";
      node.endMarker = ")";
      node.isCompatibleWithMultilineDiff = true;
      node.isCompatibleWithSingleLineDiff = true;
      node.hasNewLineAroundEntries = true;
      node.hasIndentBeforeEntries = true;
      node.skippedEntrySummary = {
        skippedEntryNames: ["value", "values"],
      };
      return node;
    }
    if (type === "indexed_entries") {
      node.startMarker = "[";
      node.endMarker = "]";
      node.isCompatibleWithMultilineDiff = true;
      node.isCompatibleWithSingleLineDiff = true;
      node.hasNewLineAroundEntries = true;
      node.hasIndentBeforeEntries = true;
      node.skippedEntrySummary = {
        skippedEntryNames: ["value", "values"],
      };
      return node;
    }
    if (type === "property_entries") {
      node.isCompatibleWithMultilineDiff = true;
      node.isCompatibleWithSingleLineDiff = true;
      node.skippedEntrySummary = {
        skippedEntryNames: ["prop", "props"],
      };
      if (node.parent.isClassPrototype) {
      } else {
        node.startMarker = "{";
        node.endMarker = "}";
        node.hasSpacingAroundEntries = true;
        node.hasNewLineAroundEntries = true;
        node.hasIndentBeforeEntries = true;
      }
      return node;
    }
    if (type === "line_entries") {
      node.isCompatibleWithMultilineDiff = true;
      node.skippedEntrySummary = {
        skippedEntryNames: ["line", "lines"],
      };
      return node;
    }
    if (type === "line_entry_value") {
      return node;
    }
    if (type === "char_entries") {
      node.overflowStartMarker = "…";
      node.overflowEndMarker = "…";
      return node;
    }
    if (type === "char_entry_value") {
      node.isPrimitive = true;
      node.isString = true;
      return node;
    }
    if (type === "internal_entry") {
      node.middleMarker = " => ";
      node.endMarker = ",";
      return node;
    }
    if (type === "indexed_entry") {
      node.endMarker = ",";
      return node;
    }
    if (type === "property_entry") {
      if (node.parent.parent.isClassPrototype) {
      } else if (isClassStaticProperty) {
        node.middleMarker = " = ";
        node.endMarker = ";";
      } else {
        node.middleMarker = ": ";
        node.endMarker = ",";
      }
      return node;
    }
    if (type === "constructor_call") {
      node.startMarker = "(";
      node.endMarker = ")";
      return node;
    }
    if (isContainer) {
      return node;
    }
    if (
      type === "indexed_entry_key" ||
      type === "line_entry_key" ||
      type === "char_entry_key"
    ) {
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
            isGrammar: true,
            type: "class_keyword",
            value: "class",
          });
          const extendedClassName = node.functionAnalysis.extendedClassName;
          if (extendedClassName) {
            node.appendChild("class_extends_keyword", {
              isGrammar: true,
              type: "class_extends_keyword",
              value: "extends",
            });
            node.appendChild("class_extended_name", {
              isGrammar: true,
              type: "class_extended_name",
              value: node.functionAnalysis.extendedClassName,
            });
          }
        }
        if (node.functionAnalysis.isAsync) {
          node.appendChild("function_async_keyword", {
            type: "function_async_keyword",
            value: "async",
            isGrammar: true,
          });
        }
        if (node.functionAnalysis.type === "classic") {
          node.appendChild("function_keyword", {
            type: "function_keyword",
            value: node.functionAnalysis.isGenerator ? "function*" : "function",
            isGrammar: true,
          });
        }
        if (node.functionAnalysis.name) {
          node.appendChild("function_name", {
            isGrammar: true,
            type: "function_name",
            value: node.functionAnalysis.name,
          });
        }
        if (node.functionAnalysis.type === "arrow") {
          node.appendChild("function_body_prefix", {
            isGrammar: true,
            type: "function_body_prefix",
            value: "() =>",
          });
        } else if (node.functionAnalysis.type === "method") {
          if (node.functionAnalysis.getterName) {
            node.appendChild("function_body_prefix", {
              isGrammar: true,
              type: "function_body_prefix",
              value: `get ${methodName}()`,
            });
          } else if (node.functionAnalysis.setterName) {
            node.appendChild("function_body_prefix", {
              isGrammar: true,
              type: "function_body_prefix",
              value: `set ${methodName}()`,
            });
          } else {
            node.appendChild("function_body_prefix", {
              isGrammar: true,
              type: "function_body_prefix",
              value: `${methodName}()`,
            });
          }
        } else if (node.functionAnalysis.type === "classic") {
          node.appendChild("function_body_prefix", {
            isGrammar: true,
            type: "function_body_prefix",
            value: `()`,
          });
        }
      } else {
        const objectTag = getObjectTag(value);
        if (
          objectTag &&
          objectTag !== "Object" &&
          objectTag !== "Array" &&
          !isFunctionPrototype
        ) {
          appendObjectTagNode(node, objectTag);
        }
      }

      const ownPropertyNameToIgnoreSet = new Set();
      const ownPropertSymbolToIgnoreSet = new Set();
      const propertyLikeSet = new Set();
      // Symbol.toPrimitive
      if (
        Symbol.toPrimitive in value &&
        typeof value[Symbol.toPrimitive] === "function"
      ) {
        ownPropertSymbolToIgnoreSet.add(Symbol.toPrimitive);
        const toPrimitiveReturnValue = value[Symbol.toPrimitive]("string");
        propertyLikeSet.add({
          isAsPrimitiveValue: true,
          key: SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY,
          value: toPrimitiveReturnValue,
        });
      }
      // valueOf()
      if (
        typeof value.valueOf === "function" &&
        value.valueOf !== Object.prototype.valueOf
      ) {
        ownPropertyNameToIgnoreSet.add("valueOf");
        const valueOfReturnValue = value.valueOf();
        const isAsPrimitiveValue =
          valueOfReturnValue &&
          typeof valueOfReturnValue !== "object" &&
          typeof valueOfReturnValue !== "function";

        if (node.childNodeMap.has("object_tag")) {
          const constructorCallNode = appendConstructorCallNode(node);
          constructorCallNode.appendChild(0, {
            isAsPrimitiveValue,
            type: "value_of_return_value",
            value: valueOfReturnValue,
            path: node.path.append("valueOf()"),
            depth: node.depth,
          });
        } else {
          propertyLikeSet.add({
            isAsPrimitiveValue,
            key: VALUE_OF_RETURN_VALUE_ENTRY_KEY,
            value: valueOfReturnValue,
          });
        }
      }

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
            ownPropertyNameToIgnoreSet.add(String(index));
            appendIndexedEntryNode(arrayIndexedEntriesNode, {
              key: index,
              value: Object.hasOwn(value, index)
                ? value[index]
                : ARRAY_EMPTY_VALUE,
            });
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
              isSetEntry: true,
              key: index,
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
            !ownPropertyNameToIgnoreSet.has(ownPropertyName) &&
            !shouldIgnoreOwnPropertyName(node, ownPropertyName)
          );
        },
      );
      const canHaveIndexedEntries = node.childNodeMap.has("indexed_entries");
      if (canHaveIndexedEntries && ownPropertyNames.length === 0) {
        // skip entirely property_entries
      } else {
        const propertyEntriesNode = appendPropertyEntriesNode(node, {
          hasMarkersWhenEmpty:
            !node.childNodeMap.has("object_tag") &&
            !node.childNodeMap.has("constructor_call") &&
            !node.childNodeMap.has("internal_entries") &&
            !canHaveIndexedEntries,
        });
        if (node.isFunction) {
          appendPropertyEntryNode(propertyEntriesNode, {
            isSourceCode: true,
            isClassStaticProperty: node.functionAnalysis.type === "class",
            key: SOURCE_CODE_ENTRY_KEY,
            value: node.functionAnalysis.argsAndBodySource,
          });
        }
        for (const ownPropertyName of ownPropertyNames) {
          const ownPropertyValue = value[ownPropertyName];
          appendPropertyEntryNode(propertyEntriesNode, {
            isClassStaticProperty: node.functionAnalysis.type === "class",
            isFunctionPrototype:
              ownPropertyName === "prototype" && node.isFunction,
            isClassPrototype:
              ownPropertyName === "prototype" &&
              node.functionAnalysis.type === "class",
            key: ownPropertyName,
            value: ownPropertyValue,
          });
        }
        for (const propertyLike of propertyLikeSet) {
          appendPropertyEntryNode(propertyEntriesNode, propertyLike);
        }
      }

      return node;
    }

    node.isPrimitive = true;
    if (typeofResult === "string") {
      node.isString = true;
      if (isGrammar) {
      } else {
        if (type === "property_entry_key") {
          if (!isValidPropertyIdentifier(value)) {
            node.hasQuotes = true;
          }
        } else {
          node.hasQuotes = true;
        }
        const lineEntriesNode = appendLineEntriesNode(node);
        let lineIndex = 0;
        let columnIndex = 0;
        const firstLineNode = appendLineEntryNode(lineEntriesNode, {
          key: lineIndex,
        });
        const firstCharEntriesNode =
          firstLineNode.childNodeMap.get("entry_value");
        const chars = tokenizeString(value);
        let doubleQuoteCount = 0;
        let singleQuoteCount = 0;
        let backtickCount = 0;
        let currentLineNode = firstLineNode;
        let currentCharEntriesNode =
          currentLineNode.childNodeMap.get("entry_value");
        for (const char of chars) {
          if (char === "\n") {
            lineIndex++;
            columnIndex = 0;
            currentLineNode = appendLineEntryNode(lineEntriesNode, {
              key: lineIndex,
            });
            currentCharEntriesNode =
              currentLineNode.childNodeMap.get("entry_value");
            continue;
          }
          if (char === DOUBLE_QUOTE) {
            doubleQuoteCount++;
          } else if (char === SINGLE_QUOTE) {
            singleQuoteCount++;
          } else if (char === BACKTICK) {
            backtickCount++;
          }
          appendCharEntryNode(currentCharEntriesNode, {
            key: columnIndex,
            value: char,
          });
          columnIndex++;
        }
        const isSingleLine = lineIndex < 1;
        if (isSingleLine) {
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
            firstCharEntriesNode.startMarker = firstCharEntriesNode.endMarker =
              bestQuote;
          }
          lineEntriesNode.hasMarkersWhenEmpty = true;
        } else {
        }
      }
    }
    if (value === undefined) {
      node.isUndefined = true;
    }

    return node;
  };
}

const DOUBLE_QUOTE = `"`;
const SINGLE_QUOTE = `'`;
const BACKTICK = "`";

const getAddedOrRemovedReason = (node) => {
  if (
    node.type === "internal_entry" ||
    node.type === "indexed_entry" ||
    node.type === "property_entry" ||
    node.type === "line_entry" ||
    node.type === "char_entry"
  ) {
    return getAddedOrRemovedReason(node.childNodeMap.get("entry_key"));
  }
  if (
    node.type === "internal_entry_key" ||
    node.type === "indexed_entry_key" ||
    node.type === "property_entry_key" ||
    node.type === "line_entry_key" ||
    node.type === "char_entry_key"
  ) {
    return node.value;
  }
  if (
    node.type === "internal_entry_value" ||
    node.type === "indexed_entry_value" ||
    node.type === "property_entry_value" ||
    node.type === "line_entry_value" ||
    node.type === "char_entry_value"
  ) {
    return getAddedOrRemovedReason(node.parent);
  }
  if (node.type === "value_of_return_value") {
    return "value_of_own_method";
  }
  return "unknown";
};
const asPrimitiveNode = (node) => {
  const symbolToPrimitiveReturnValueNode =
    getSymbolToPrimitiveReturnValueNode(node);
  if (symbolToPrimitiveReturnValueNode) {
    return symbolToPrimitiveReturnValueNode;
  }
  const valueOfReturnValueNode = getValueOfReturnValueNode(node);
  if (valueOfReturnValueNode && valueOfReturnValueNode.isPrimitive) {
    return valueOfReturnValueNode;
  }
  return null;
};
const getOtherNodeHoldingSomething = (node, comparison) => {
  let comparisonHoldingSomething;
  if (node.parent.type === "constructor_call") {
    comparisonHoldingSomething = comparison.parent.parent;
  } else {
    // type === "property_entry_value"
    comparisonHoldingSomething = comparison.parent.parent.parent;
  }
  if (node.name === "actual") {
    return comparisonHoldingSomething.expectNode;
  }
  return comparisonHoldingSomething.actualNode;
};
const getSymbolToPrimitiveReturnValueNode = (node) => {
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
};
const getValueOfReturnValueNode = (node) => {
  const constructorCallNode = node.childNodeMap.get("constructor_call");
  if (constructorCallNode) {
    const firstArgNode = constructorCallNode.childNodeMap.get(0);
    if (firstArgNode && firstArgNode.type === "value_of_return_value") {
      return firstArgNode;
    }
  }
  const propertyEntriesNode = node.childNodeMap.get("property_entries");
  if (!propertyEntriesNode) {
    return null;
  }
  const valueOfReturnValuePropertyNode = propertyEntriesNode.childNodeMap.get(
    VALUE_OF_RETURN_VALUE_ENTRY_KEY,
  );
  if (!valueOfReturnValuePropertyNode) {
    return null;
  }
  return valueOfReturnValuePropertyNode.childNodeMap.get("entry_value");
};
const appendObjectTagNode = (node, objectTag) => {
  const objectTagNode = node.appendChild("object_tag", {
    isGrammar: true,
    type: "object_tag",
    value: objectTag,
    path: node.path.append("[[ObjectTag]]"),
  });
  return objectTagNode;
};
const appendConstructorCallNode = (node) => {
  return node.appendChild("constructor_call", {
    isContainer: true,
    type: "constructor_call",
  });
};

const appendInternalEntriesNode = (node) => {
  const internalEntriesNode = node.appendChild("internal_entries", {
    isContainer: true,
    type: "internal_entries",
    value: [],
    hasMarkersWhenEmpty: true,
  });
  return internalEntriesNode;
};
const appendInternalEntryNode = (node, { isSetEntry, key, value }) => {
  node.value.push(key);
  const internalEntryNode = node.appendChild(key, {
    isContainer: true,
    type: "internal_entry",
    path: node.path.append(key),
  });
  internalEntryNode.appendChild("entry_key", {
    type: "internal_entry_key",
    value: key,
    isHidden: isSetEntry,
  });
  internalEntryNode.appendChild("entry_value", {
    type: "internal_entry_value",
    value,
  });
  return internalEntryNode;
};
const appendIndexedEntriesNode = (node) => {
  const indexedEntriesNode = node.appendChild("indexed_entries", {
    isContainer: true,
    type: "indexed_entries",
    value: [],
    hasMarkersWhenEmpty: true,
  });
  return indexedEntriesNode;
};
const appendIndexedEntryNode = (node, { key, value }) => {
  node.value.push(key);
  const indexedEntryNode = node.appendChild(key, {
    isContainer: true,
    type: "indexed_entry",
    path: node.path.append(key, { isIndexedEntry: true }),
  });
  indexedEntryNode.appendChild("entry_key", {
    type: "indexed_entry_key",
    value: key,
    isHidden: true,
  });
  indexedEntryNode.appendChild("entry_value", {
    type: "indexed_entry_value",
    value,
  });
  return indexedEntryNode;
};
const appendPropertyEntriesNode = (node, { hasMarkersWhenEmpty }) => {
  const propertyEntriesNode = node.appendChild("property_entries", {
    isContainer: true,
    type: "property_entries",
    value: [],
    hasMarkersWhenEmpty,
  });
  return propertyEntriesNode;
};
const appendPropertyEntryNode = (
  node,
  {
    isSourceCode,
    isFunctionPrototype,
    isClassPrototype,
    isClassStaticProperty,
    isAsPrimitiveValue,
    key,
    value,
  },
) => {
  node.value.push(key);
  const propertyEntryNode = node.appendChild(key, {
    isContainer: true,
    isFunctionPrototype,
    isClassStaticProperty,
    isClassPrototype,
    type: "property_entry",
    path: node.path.append(key),
  });

  const propertyEntryValueNode = propertyEntryNode.appendChild("entry_value", {
    type: "property_entry_value",
    value,
    isSourceCode,
    isFunctionPrototype,
    isClassPrototype,
    isAsPrimitiveValue,
    methodName: key,
  });
  if (isClassStaticProperty && !isClassPrototype) {
    propertyEntryNode.appendChild("static_keyword", {
      isGrammar: true,
      isHidden:
        isSourceCode ||
        propertyEntryValueNode.functionAnalysis.type === "method",
      type: "class_property_static_keyword",
      value: "static",
    });
  }
  propertyEntryNode.appendChild("entry_key", {
    type: "property_entry_key",
    value: key,
    isHidden:
      isSourceCode ||
      propertyEntryValueNode.functionAnalysis.type === "method" ||
      isClassPrototype,
  });
  return propertyEntryNode;
};
const appendLineEntriesNode = (node) => {
  const lineEntriesNode = node.appendChild("line_entries", {
    isContainer: true,
    type: "line_entries",
    value: [],
  });
  return lineEntriesNode;
};
const appendLineEntryNode = (node, { key }) => {
  node.value.push(key);
  const lineEntryNode = node.appendChild(key, {
    isContainer: true,
    type: "line_entry",
    path: node.path.append(`#L${key + 1}`),
  });
  lineEntryNode.appendChild("entry_key", {
    type: "line_entry_key",
    value: key,
    isHidden: true,
  });
  lineEntryNode.appendChild("entry_value", {
    isContainer: true,
    type: "char_entries",
    value: [],
  });
  return lineEntryNode;
};
const appendCharEntryNode = (node, { key, value }) => {
  node.value.push(key);
  const charEntryNode = node.appendChild(key, {
    isContainer: true,
    type: "char_entry",
    path: node.path.append(`C${key + 1}`),
  });
  charEntryNode.appendChild("entry_key", {
    type: "char_entry_key",
    value: key,
    isHidden: true,
  });
  charEntryNode.appendChild("entry_value", {
    type: "char_entry_value",
    value,
  });
  return charEntryNode;
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
