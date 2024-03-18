import stringWidth from "string-width";
import Graphemer from "graphemer";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isAssertionError, createAssertionError } from "./assertion_error.js";

// ANSI.supported = false;

const removedSign = UNICODE.FAILURE_RAW;
const addedSign = UNICODE.FAILURE_RAW;
const unexpectedSign = UNICODE.FAILURE_RAW;
const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectedColor = ANSI.RED;
const expectedColor = ANSI.GREEN;
const unexpectedSignColor = ANSI.GREY;
const removedSignColor = ANSI.GREY;
const addedSignColor = ANSI.GREY;
const ARRAY_EMPTY_VALUE = { array_empty_value: true }; // Symbol.for('array_empty_value') ?
// const VALUE_OF_NOT_FOUND = { value_of_not_found: true };
// const DOES_NOT_EXISTS = { does_not_exists: true };

export const createAssert = ({ format = (v) => v } = {}) => {
  const assert = (...args) => {
    // param validation
    let firstArg;
    let actualIsFirst;
    {
      if (args.length === 0) {
        throw new Error(
          `assert must be called with { actual, expected }, missing first argument`,
        );
      }
      if (args.length > 1) {
        throw new Error(
          `assert must be called with { actual, expected }, received too many arguments`,
        );
      }
      firstArg = args[0];
      if (typeof firstArg !== "object" || firstArg === null) {
        throw new Error(
          `assert must be called with { actual, expected }, received ${firstArg} as first argument instead of object`,
        );
      }
      if ("actual" in firstArg === false) {
        throw new Error(
          `assert must be called with { actual, expected }, missing actual property on first argument`,
        );
      }
      if ("expected" in firstArg === false) {
        throw new Error(
          `assert must be called with { actual, expected }, missing expected property on first argument`,
        );
      }
    }
    const {
      actual,
      expected,
      maxDepth = 5,
      maxColumns = 100,
      maxDiffPerObject = 5,
      maxValueAroundDiff = 2,
      maxValueInsideDiff = 4,
      maxDepthInsideDiff = 1,
      maxLineAroundDiff = 2,
      quote = "auto",
      preserveLineBreaks,
      signs,
    } = firstArg;
    const maxValueBeforeDiff = maxValueAroundDiff;
    const maxValueAfterDiff = maxValueAroundDiff;
    const maxLineBeforeDiff = maxLineAroundDiff;
    const maxLineAfterDiff = maxLineAroundDiff;

    actualIsFirst = true;
    // actualIsFirst =
    //   Object.keys(firstArg).indexOf("actual") <
    //   Object.keys(firstArg).indexOf("expected");
    const actualNode = createValueNode({
      name: "actual",
      value: actual,
    });
    const expectedNode = createValueNode({
      name: "expected",
      value: expected,
    });
    const causeCounters = {
      total: 0,
      displayed: 0,
    };
    const causeSet = new Set();
    const shouldIgnoreDiff = (node) => {
      if (node.type === "line") {
        return true;
      }
      if (node.type === "char") {
        return true;
      }
      if (
        node.type === "as_string" &&
        node.parent.canDiffAsStrings &&
        node.canDiffUrlParts
      ) {
        return true;
      }
      if (actualNode.redundant && expectedNode.redundant) {
        // diff expected, one is primitive, other is composite for example
        return true;
      }
      return false;
    };
    const addNodeCausingDiff = (node) => {
      if (shouldIgnoreDiff(node)) {
        return;
      }
      if (node.parent && shouldIgnoreDiff(node.parent)) {
        return;
      }
      causeCounters.total++;
      causeSet.add(node);
    };
    const onNodeDisplayed = (node) => {
      if (causeSet.has(node)) {
        causeSet.delete(node);
        causeCounters.displayed++;
      }
      if (node.type === "property") {
        // happens when node is skipped
        // in that case we want to consider all child nodes as displayed
        // (they are "displayed" in the summary)
        for (const descriptor of Object.keys(node.descriptors)) {
          const descriptorNode = node.descriptors[descriptor];
          if (descriptorNode) {
            onNodeDisplayed(descriptorNode);
          }
        }
      }
    };

    const settleCounters = (node) => {
      const { counters } = node.diff;
      const { self, inside, overall } = counters;
      self.any = self.modified + self.removed + self.added;
      inside.any = inside.modified + inside.removed + inside.added;
      overall.removed = self.removed + inside.removed;
      overall.added = self.added + inside.added;
      overall.modified = self.modified + inside.modified;
      overall.any = self.any + inside.any;
    };
    const appendCounters = (counter, otherCounter) => {
      counter.any += otherCounter.any;
      counter.removed += otherCounter.removed;
      counter.added += otherCounter.added;
      counter.modified += otherCounter.modified;
    };

    const compare = (
      comparison,
      {
        // ignoreDiff is meant to ignore the diff between actual/expected
        // (usually because comparison cannot be made (added,removed, visiting something different))
        // but the structure still have to be visited (properties, values, valueOf, ...)
        ignoreDiff,
      } = {},
    ) => {
      const doCompare = () => {
        const { actualNode, expectedNode } = comparison;

        if (!actualNode) {
          addNodeCausingDiff(comparison);
          comparison.diff.counters.self.added++;
          return;
        }

        if (!expectedNode) {
          addNodeCausingDiff(comparison);
          comparison.diff.counters.self.removed++;
          return;
        }

        if (actualNode.type === "property") {
          const visitPropertyDescriptor = (descriptorName) => {
            const actualPropertyDescriptorNode =
              actualNode.descriptorNodes[descriptorName];
            const expectedPropertyDescriptorNode =
              expectedNode.descriptorNodes[descriptorName];
            const propertyDescriptorComparison = createComparison(
              actualPropertyDescriptorNode,
              expectedPropertyDescriptorNode,
            );
            compareInside(propertyDescriptorComparison, { ignoreDiff });
          };
          visitPropertyDescriptor("value");
          visitPropertyDescriptor("enumerable");
          visitPropertyDescriptor("writable");
          visitPropertyDescriptor("configurable");
          visitPropertyDescriptor("set");
          visitPropertyDescriptor("get");
          return;
        }

        const onSelfDiff = () => {
          addNodeCausingDiff(comparison);
          comparison.diff.counters.self.modified++;
        };
        const addSelfDiff = (diff) => {
          Object.assign(comparison.diff, diff);
          if (diff.category) {
            if (actualNode.isUrlString && expectedNode.isUrlString) {
              return;
            }
          }

          onSelfDiff();
        };
        const compareInside = (insideComparison, { ignoreDiff }) => {
          compare(insideComparison, { ignoreDiff });
          if (insideComparison.diff.counters.overall.any) {
            appendCounters(
              comparison.diff.counters.inside,
              insideComparison.diff.counters.overall,
            );
          }
        };

        let compareAsStrings;
        if (ignoreDiff) {
          compareAsStrings = false;
        } else if (actualNode.isUrl && expectedNode.isString) {
          compareAsStrings = true;
          onSelfDiff();
        } else if (expectedNode.isUrl && actualNode.isString) {
          compareAsStrings = true;
          onSelfDiff();
        } else {
          compareAsStrings = false;
        }
        let ignoreReferenceDiff = ignoreDiff || compareAsStrings;
        let ignoreCategoryDiff = ignoreDiff || compareAsStrings;
        let ignorePrototypeDiff = ignoreDiff;
        let ignoreValueOfReturnValueDiff = compareAsStrings;

        reference: {
          if (ignoreReferenceDiff) {
            break reference;
          }
          if (actualNode.reference !== expectedNode.reference) {
            addSelfDiff({ reference: true });
          }
        }
        category: {
          if (ignoreCategoryDiff) {
            break category;
          }
          if (actualNode.wellKnownId !== expectedNode.wellKnownId) {
            addSelfDiff({ category: true });
            break category;
          }
          const actualIsPrimitive = actualNode.isPrimitive;
          const expectedIsPrimitive = expectedNode.isPrimitive;
          if (actualIsPrimitive !== expectedIsPrimitive) {
            addSelfDiff({ category: true });
            break category;
          }
          if (
            actualIsPrimitive &&
            expectedIsPrimitive &&
            actualNode.value !== expectedNode.value
          ) {
            addSelfDiff({ category: true });
            break category;
          }
          const actualIsComposite = actualNode.isComposite;
          const expectedIsComposite = expectedNode.isComposite;
          if (actualIsComposite !== expectedIsComposite) {
            addSelfDiff({ category: true });
            break category;
          }
          // maybe array check not needed as subtype will differ
          const actualIsArray = actualNode.isArray;
          const expectedIsArray = expectedNode.isArray;
          if (actualIsArray !== expectedIsArray) {
            addSelfDiff({ category: true });
            break category;
          }
          const actualSubtype = actualNode.subtype;
          const expectedSubtype = expectedNode.subtype;
          if (actualSubtype !== expectedSubtype) {
            addSelfDiff({ category: true });
            break category;
          }
        }
        inside: {
          prototype: {
            if (ignorePrototypeDiff) {
              break prototype;
            }
            const actualPrototypeNode = actualNode.prototypeNode;
            const expectedPrototypeNode = expectedNode.prototypeNode;
            if (!actualPrototypeNode && !expectedPrototypeNode) {
              break prototype;
            }
            const prototypeComparison = createComparison(
              actualPrototypeNode,
              expectedPrototypeNode,
            );
            const prototypeAreDifferentAndWellKnown =
              (actualNode.isArray && !expectedNode.isArray) ||
              (!actualNode.isArray && expectedNode.isArray) ||
              actualNode.isComposite !== expectedNode.isComposite;
            comparison.prototypeAreDifferentAndWellKnown =
              prototypeAreDifferentAndWellKnown;
            compareInside(prototypeComparison, {
              ignoreDiff:
                comparison.diff.category || prototypeAreDifferentAndWellKnown,
            });
            comparison.diff.prototype = prototypeComparison.diff;
          }
          value_of_return_value: {
            if (ignoreValueOfReturnValueDiff) {
              break value_of_return_value;
            }
            const actualValueOfReturnValueNode =
              actualNode.valueOfReturnValueNode;
            const expectedValueOfReturnValueNode =
              expectedNode.valueOfReturnValueNode;
            if (
              !actualValueOfReturnValueNode &&
              !expectedValueOfReturnValueNode
            ) {
              break value_of_return_value;
            }
            const valueOfReturnValueComparison = createComparison(
              actualValueOfReturnValueNode,
              expectedValueOfReturnValueNode,
            );
            let ignoreValueOfDiff = ignoreDiff;
            if (
              comparison.diff.category &&
              // String/string comparison is ok
              actualNode.subtype.toLowerCase() !==
                expectedNode.subtype.toLowerCase()
            ) {
              ignoreValueOfDiff = true;
            } else if (
              comparison.diff.prototype &&
              comparison.diff.prototype.counters.overall.any > 0
            ) {
              ignoreValueOfDiff = true;
            }
            compareInside(valueOfReturnValueComparison, {
              ignoreDiff: ignoreValueOfDiff,
            });
            comparison.diff.valueOfReturnValue =
              valueOfReturnValueComparison.diff;
          }
          as_string: {
            if (!actualNode.isUrl && !expectedNode.isUrl) {
              break as_string;
            }
            const actualAsStringNode = actualNode.valueOfReturnValueNode;
            const expectedAsStringNode = expectedNode.valueOfReturnValueNode;
            if (!actualAsStringNode && !expectedAsStringNode) {
              break as_string;
            }
            const asStringComparison = createComparison(
              actualAsStringNode,
              expectedAsStringNode,
            );
            compareInside(asStringComparison, { ignoreDiff });
            comparison.diff.asString = asStringComparison.diff;
          }

          string: {
            lines: {
              const actualLineNodes = actualNode.lineNodes || [];
              const expectedLineNodes = expectedNode.linesNodes || [];

              const visitLineNode = (lineNode) => {
                const lineIndex = lineNode.index;
                const actualLineNode = actualLineNodes[lineIndex];
                const expectedLineNode = expectedLineNodes[lineIndex];
                const lineComparison = createComparison({
                  actualLineNode,
                  expectedLineNode,
                });
                compareInside(lineComparison, { ignoreDiff });
                comparison.diff.lines[lineIndex] = lineComparison.diff;
              };
              for (const actualLineNode of actualLineNodes) {
                visitLineNode(actualLineNode);
              }
              for (const expectedLineNode of expectedLineNodes) {
                visitLineNode(expectedLineNode);
              }
            }
            chars: {
              const actualCharNodes = actualNode.charNodes || [];
              const expectedCharNodes = expectedNode.charNodes || [];

              const visitCharNode = (charNode) => {
                const charNodeIndex = charNode.index;
                const actualCharNode = actualCharNodes[charNodeIndex];
                const expectedCharNode = expectedCharNodes[charNodeIndex];
                const charComparison = createComparison({
                  actualCharNode,
                  expectedCharNode,
                });
                compareInside(charComparison, { ignoreDiff });
                comparison.chars[charNodeIndex] = charComparison.diff;
              };
              for (const actualCharNode of actualCharNodes) {
                visitCharNode(actualCharNode);
              }
              for (const expectedCharNode of expectedCharNodes) {
                visitCharNode(expectedCharNode);
              }
            }
          }
          url_parts: {
            const actualUrlPartNodes = actualNode.urlPartNodes || {};
            const expectedUrlPartNodes = expectedNode.urlPartNodes || {};

            const visitUrlPart = (urlPartName) => {
              const actualUrlPartNode = actualUrlPartNodes[urlPartName];
              const expectedUrlPartNode = expectedUrlPartNodes[urlPartName];
              const urlPartComparisonNode = createComparison(
                actualUrlPartNode,
                expectedUrlPartNode,
              );
              compareInside(urlPartComparisonNode, { ignoreDiff });
              comparison.urlParts[urlPartName] = urlPartComparisonNode.diff;
            };
            for (const actualUrlPartName of Object.keys(actualUrlPartNodes)) {
              visitUrlPart(actualUrlPartName);
            }
            for (const expectedUrlPartName of Object.keys(
              expectedUrlPartNodes,
            )) {
              visitUrlPart(expectedUrlPartName);
            }
          }
          indexed_values: {
            const actualIndexedValueNodes = actualNode.indexedValueNodes || [];
            const expectedIndexedValueNodes =
              expectedNode.indexedValueNodes || [];

            if (actualNode.isSet && expectedNode.isSet) {
              const visitSetValue = (indexedValueNode) => {
                const index = indexedValueNode.index;
                const indexedValueComparison = createComparison(
                  actualNode.value.has(indexedValueNode.value)
                    ? actualNode.indexedValueNodes[index]
                    : null,
                  expectedNode.value.has(indexedValueNode.value)
                    ? expectedNode.indexedValueNodes[index]
                    : null,
                );
                // indexedValueComparisonNode.owner = indexedValueNode.name;
                compareInside(indexedValueComparison, { ignoreDiff: true });
                comparison.indexedValues[index] = indexedValueComparison.diff;
              };
              for (const actualIndexedValueNode of actualIndexedValueNodes) {
                visitSetValue(actualIndexedValueNode);
              }
              for (const expectedIndexedValueNode of expectedIndexedValueNodes) {
                visitSetValue(expectedIndexedValueNode);
              }
              break indexed_values;
            }

            const visitIndexedValue = (indexedValueNode) => {
              const index = indexedValueNode.index;
              const actualHasOwn = Object.hasOwn(
                actualIndexedValueNodes,
                index,
              );
              const expectedHasOwn = Object.hasOwn(
                expectedIndexedValueNodes,
                index,
              );
              const indexedValueComparison = createComparison(
                actualHasOwn
                  ? actualIndexedValueNodes[index]
                  : actualNode.indexedValueNodes &&
                      index < actualNode.indexedValueNodes.length
                    ? ARRAY_EMPTY_VALUE
                    : undefined,
                expectedHasOwn
                  ? expectedIndexedValueNodes[index]
                  : expectedNode.indexedValueNodes &&
                      index < expectedNode.indexedValueNodes.length
                    ? ARRAY_EMPTY_VALUE
                    : undefined,
              );
              compareInside(indexedValueComparison, { ignoreDiff });
              comparison.indexedValues[index] = indexedValueComparison.diff;
            };
            for (const expectedIndexedValueNode of expectedIndexedValueNodes) {
              visitIndexedValue(expectedIndexedValueNode);
            }
            for (const actualIndexedValueNode of actualIndexedValueNodes) {
              visitIndexedValue(actualIndexedValueNode);
            }
          }
          properties: {
            const actualPropertyNodes = actualNode.propertyNodes || {};
            const expectedPropertyNodes = expectedNode.propertyNodes || {};

            const visitProperty = (property) => {
              const actualPropertyNode = actualPropertyNodes[property];
              const expectedPropertyNode = expectedPropertyNodes[property];
              const propertyNodeComparison = createComparison(
                actualPropertyNode,
                expectedPropertyNode,
              );
              compareInside(propertyNodeComparison, { ignoreDiff });
              comparison.diff.properties[property] =
                propertyNodeComparison.diff;
            };
            for (const actualPropertyName of Object.keys(actualPropertyNodes)) {
              visitProperty(actualPropertyName);
            }
            for (const expectedPropertyName of Object.keys(
              expectedPropertyNodes,
            )) {
              visitProperty(expectedPropertyName);
            }
          }
        }
      };

      doCompare();
      settleCounters(comparison);
    };
    const createComparison = (actualNode, expectedNode) => {
      const comparisonNode = {
        actualNode,
        expectedNode,
        diff: {
          counters: {
            overall: {
              any: 0,
              modified: 0,
              removed: 0,
              added: 0,
            },
            self: {
              any: 0,
              modified: 0,
              removed: 0,
              added: 0,
            },
            inside: {
              any: 0,
              modified: 0,
              removed: 0,
              added: 0,
            },
          },
          reference: null,
          category: null,
          prototype: null,
          valueOfReturnValue: null,
          asString: null,
          properties: {},
          indexedValues: [],
        },
      };

      const leftOrRightValueNode = actualNode || expectedNode;
      comparisonNode.type = leftOrRightValueNode.type;
      comparisonNode.depth = leftOrRightValueNode.depth;
      comparisonNode.property = leftOrRightValueNode.property;
      comparisonNode.descriptor = leftOrRightValueNode.descriptor;
      comparisonNode.index = leftOrRightValueNode.index;

      return comparisonNode;
    };

    const rootComparison = createComparison(actualNode, expectedNode);
    compare(rootComparison);
    if (causeSet.size === 0) {
      return;
    }

    let startComparison = rootComparison;
    const [firstComparisonCausingDiff] = causeSet;
    if (
      firstComparisonCausingDiff.depth >= maxDepth &&
      !rootComparison.diff.category
    ) {
      const comparisonsFromRootToTarget = [firstComparisonCausingDiff];
      let currentComparison = firstComparisonCausingDiff;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const parentComparison = currentComparison.parent;
        if (parentComparison) {
          comparisonsFromRootToTarget.unshift(parentComparison);
          currentComparison = parentComparison;
        } else {
          break;
        }
      }
      let startComparisonDepth = firstComparisonCausingDiff.depth - maxDepth;
      let valuePath = createValuePath();
      for (const comparison of comparisonsFromRootToTarget) {
        if (
          startComparison === rootComparison &&
          comparison.type === "property_descriptor" &&
          expectedNode.depth > startComparisonDepth
        ) {
          comparison.path = String(valuePath);
          startComparison = comparison;
          break;
        }
        if (comparison === rootComparison) {
          continue;
        }
        if (comparison.type === "property") {
          valuePath = valuePath.append(comparison.property);
          continue;
        }
        if (comparison.type === "property_descriptor") {
          if (comparison.descriptor === "value") {
            continue;
          }
          valuePath = valuePath.append(comparison.descriptor, {
            special: true,
          });
          continue;
        }
        if (comparison.type === "indexed_value") {
          valuePath = valuePath.append(comparison.index);
          continue;
        }
        if (comparison.type === "char") {
          valuePath = valuePath.append(comparison.index);
          continue;
        }
        if (comparison.type === "line") {
          valuePath = valuePath.append(comparison.index);
          continue;
        }
      }
    }

    const actualValueMeta = {
      resultType: "actualNode",
      name: "actual",
      color: unexpectedColor,
    };
    const expectedValueMeta = {
      resultType: "expectedNode",
      name: "expect",
      color: expectedColor,
    };
    const firstValueMeta = actualIsFirst ? actualValueMeta : expectedValueMeta;
    const secondValueMeta = actualIsFirst ? expectedValueMeta : actualValueMeta;

    let firstPrefix = "";
    firstPrefix += ANSI.color(firstValueMeta.name, sameColor);
    firstPrefix += ANSI.color(":", sameColor);
    firstPrefix += " ";
    // si le start node a une diff alors il faudrait lui mettre le signe + devant actual
    const displayedIdMap = new Map();
    let idCount = 0;
    const getDisplayedId = (nodeId) => {
      const existingId = displayedIdMap.get(nodeId);
      if (existingId) {
        return existingId;
      }
      const idDisplayed = idCount + 1;
      idCount++;
      displayedIdMap.set(nodeId, idDisplayed);
      return idDisplayed;
    };
    const contextBase = {
      onNodeDisplayed,
      getDisplayedId,
      startComparison,
      signs,
      initialDepth: -startComparison.depth,
      maxColumns,
      maxDepth,
      maxDiffPerObject,
      maxValueBeforeDiff,
      maxValueAfterDiff,
      maxValueInsideDiff,
      maxDepthInsideDiff,
      maxLineBeforeDiff,
      maxLineAfterDiff,
      quote,
      preserveLineBreaks,
    };

    const firstValueDiff = writeDiff(startComparison, {
      ...contextBase,
      resultType: firstValueMeta.resultType,
      textIndent: stringWidth(firstPrefix),
    });

    let secondPrefix = "";
    secondPrefix += ANSI.color(secondValueMeta.name, sameColor);
    secondPrefix += ANSI.color(":", sameColor);
    secondPrefix += " ";
    const secondValueDiff = writeDiff(startComparison, {
      ...contextBase,
      resultType: secondValueMeta.resultType,
      textIndent: stringWidth(secondPrefix),
    });

    let diffMessage = "";
    diffMessage += firstPrefix;
    diffMessage += firstValueDiff;
    diffMessage += "\n";
    diffMessage += secondPrefix;
    diffMessage += secondValueDiff;

    let message;
    if (rootComparison.diff.category) {
      message = `${ANSI.color(firstValueMeta.resultType, firstValueMeta.color)} and ${ANSI.color(secondValueMeta.resultType, secondValueMeta.color)} are different`;
    } else {
      message = `${ANSI.color(firstValueMeta.resultType, firstValueMeta.color)} and ${ANSI.color(secondValueMeta.resultType, secondValueMeta.color)} have ${causeCounters.total} ${causeCounters.total === 1 ? "difference" : "differences"}`;
    }
    message += ":";
    message += "\n\n";
    const infos = [];
    const diffNotDisplayed = causeCounters.total - causeCounters.displayed;
    if (diffNotDisplayed) {
      if (diffNotDisplayed === 1) {
        infos.push(`to improve readability 1 diff is completely hidden`);
      } else {
        infos.push(
          `to improve readability ${diffNotDisplayed} diffs are completely hidden`,
        );
      }
    }
    if (startComparison !== rootComparison) {
      infos.push(
        `diff starts at ${ANSI.color(startComparison.path, ANSI.YELLOW)}`,
      );
    }
    if (infos.length) {
      for (const info of infos) {
        message += `${UNICODE.INFO} ${info}`;
        message += "\n";
      }
      message += "\n";
    }
    message += `${diffMessage}`;

    const error = new Error(message);
    error.name = "AssertionError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error, assert);
    }
    throw error;
  };

  assert.format = format;
  assert.isAssertionError = isAssertionError;
  assert.createAssertionError = createAssertionError;

  return assert;
};

let createValueNode;
{
  const compositeReferenceMap = new Map();
  let nodeId = 1;

  createValueNode = ({ name, value }) => {
    const _createValueNode = ({ parent, type, value, origin }) => {
      const node = {
        id: nodeId++,
      };

      info: {
        let composite;
        let wellKnownId;
        let subtype;
        let isArray;
        let isSet = false;
        let isString = false;
        let isStringObject = false;
        let isUrl = false;
        let isUrlString = false;
        let reference = null;
        if (value === ARRAY_EMPTY_VALUE) {
          composite = false;
          isArray = false;
          wellKnownId = "empty";
          subtype = "empty";
        }
        // else if (value === DOES_NOT_EXISTS) {
        //   composite = false;
        //   isArray = false;
        //   wellKnownId = "not_found";
        //   subtype = "not_found";
        // }
        else {
          composite = isComposite(value);
          wellKnownId = getWellKnownId(value);
          if (composite) {
            isArray = Array.isArray(value) && value !== Array.prototype;
            subtype = getSubtype(value);
            reference = compositeReferenceMap.get(value);
            if (reference) {
              reference.referenceFromOthersSet.add(node);
            } else {
              compositeReferenceMap.set(value, node);
            }

            visitPrototypes(value, (proto) => {
              if (proto.constructor) {
                if (proto.constructor.name === "Set") {
                  isSet = true;
                } else if (proto.constructor.name === "String") {
                  isStringObject = true;
                } else if (proto.constructor.name === "URL") {
                  isUrl = true;
                }
              }
            });
          } else {
            isArray = false;
            if (value === null) {
              subtype = "null";
            } else {
              subtype = typeof value;
              if (subtype === "string") {
                isString = true;
                isUrlString = canParseUrl(value);
              }
            }
          }
        }
        const canHaveIndexedValues = isArray || isSet;
        const canHaveLines =
          (isString || isStringObject) && type !== "line" && type !== "char";
        // const canHaveChars = isString && type !== "char";
        const canHaveChars =
          // isString is important because value can be undefined, for example when:
          // - actual is not a string and expected is
          // - actual string is shorter
          // - ...
          isString && type === "line";
        const canHaveProps = composite;
        let inConstructor;
        if (type === "value_of_return_value") {
          // we display in constructor if parent subtype is not Object nor Array
          // (if there is a constructor displayed)
          const parentSubtype = parent.subtype;
          if (parentSubtype !== "Object" && parentSubtype !== "Array") {
            inConstructor = true;
          }
        }
        if (type === "as_string") {
          if (parent.isUrl || !composite) {
            inConstructor = true;
          }
        }
        let depth;
        if (parent) {
          if (type === "property") {
            depth = parent.depth;
          } else if (type === "value_of_return_value" && inConstructor) {
            depth = parent.depth;
          } else if (type === "to_string_return_value" && inConstructor) {
            depth = parent.depth;
          } else if (type === "url_part") {
            depth = parent.depth;
          } else {
            depth = parent.depth + 1;
          }
        } else {
          depth = 0;
        }
        Object.assign(node, {
          depth,
          type,
          value,
          valueOf: () => {
            throw new Error(`use ${name}.value`);
          },
          origin,
          subtype,
          isComposite: composite,
          isPrimitive: !composite,
          isString,
          isArray,
          isSet,
          isUrl,
          isUrlString,
          canHaveIndexedValues,
          canHaveLines,
          canHaveChars,
          canHaveProps,
          wellKnownId,
          inConstructor,
          reference: null,
          referenceFromOthersSet: new Set(),

          keys: null,
          chars: null,
        });
      }

      node.structureIsKnown = node.wellKnownId || node.reference;

      // prototype
      if (node.isComposite && !node.structureIsKnown) {
        const prototypeNode = _createValueNode({
          parent: node,
          type: "prototype",
          value: Object.getPrototypeOf(node.value),
        });
        node.prototypeNode = prototypeNode;
      }

      // valueOf()
      if (
        node.isComposite &&
        !node.structureIsKnown &&
        "valueOf" in node.value &&
        typeof node.value.valueOf === "function"
      ) {
        const valueOfReturnValueNode = _createValueNode({
          parent: node,
          type: "value_of_return_value",
          value: node.value.valueOf(),
        });
        if (valueOfReturnValueNode.value === node.value) {
          valueOfReturnValueNode.redundant = true;
        }

        node.valueOfReturnValueNode = valueOfReturnValueNode;
      }

      // toString()
      if (
        node.isComposite &&
        !node.structureIsKnown &&
        "toString" in node.value &&
        typeof node.value.toString === "function"
      ) {
        const asStringNode = _createValueNode({
          parent: node,
          type: "as_string",
          value: String(node.value),
        });
        node.asStringNode = asStringNode;
      }

      // properties
      if (node.isComposite && !node.structureIsKnown) {
        const propertyNodes = {};
        const keys = [];

        const shouldIgnore = (property) => {
          if (node.isArray) {
            if (property === "length") {
              return true;
            }
            if (isArrayIndex(property)) {
              return true;
            }
          }
          if (node.isComposite && node.subtype === "String") {
            if (property === "length") {
              return true;
            }
            if (isArrayIndex(property)) {
              return true;
            }
          }
          // if (valueInfo.isUrl) {
          //   if (property === "href" && node.canDiffUrlParts) {
          //     return true;
          //   }
          //   if (
          //     [
          //       "origin",
          //       "host",

          //       "protocol",
          //       "hostname",
          //       "username",
          //       "password",
          //       "pathname",
          //       "search",
          //       "searchParams",
          //       "hash",
          //     ].includes(property)
          //   ) {
          //     return true;
          //   }
          // }
          if (node.valueOfReturnValue && property === "valueOf") {
            return true;
          }
          return false;
        };
        const propertyNames = Object.getOwnPropertyNames(node.value);
        for (const propertyName of propertyNames) {
          if (shouldIgnore(propertyName)) {
            continue;
          }
          keys.push(propertyName);

          const propertyDescriptor = Object.getOwnPropertyDescriptor(
            node.value,
            propertyName,
          );
          const propertyNode = _createValueNode({
            parent: node,
            type: "property",
            value: propertyDescriptor,
          });
          propertyNode.property = propertyName;
          propertyNode.descriptors = {
            value: null,
            enumerable: null,
            writable: null,
            configurable: null,
            set: null,
            get: null,
          };
          for (const propertyDescriptorName of Object.keys(
            propertyDescriptor,
          )) {
            const propertyDescriptorValue =
              propertyDescriptor[propertyDescriptorName];
            const propertyDescriptorNode = _createValueNode({
              parent: propertyNode,
              type: "property_descriptor",
              value: propertyDescriptorValue,
            });
            propertyDescriptorNode.property = propertyName;
            propertyDescriptorNode.descriptor = propertyDescriptorName;
            propertyNode.descriptors[propertyDescriptorName] =
              propertyDescriptorNode;
          }
          propertyNodes[propertyName] = propertyNode;
        }

        node.keys = keys;
        node.propertyNodes = propertyNodes;
      }

      // indexed_values
      if (node.canHaveIndexedValues && !node.structureIsKnown) {
        const indexedValueNodes = [];

        const indexedValues = node.isSet
          ? Array.from(node.value.values())
          : node.value;
        for (const indexedValue of indexedValues) {
          const indexedValueNode = _createValueNode({
            parentNode: node,
            type: "indexed_value",
            value: indexedValue,
          });
          const indexedValueNodeIndex = indexedValueNodes.length;
          indexedValueNode.index = indexedValueNodeIndex;
          indexedValueNodes[indexedValueNodeIndex] = indexedValueNode;
        }

        node.indexedValueNodes = indexedValueNodes;
      }

      // string (lines and chars)
      if (node.canHaveLines && !node.structureIsKnown) {
        node.lineNodes = [];
        const lines = node.value.split(/\r?\n/);
        for (const line of lines) {
          const lineNode = _createValueNode({
            parentNode: node,
            type: "line",
            value: line,
          });
          const lineNodeIndex = node.lineNodes.length;
          node.lineNodes[lineNodeIndex] = lineNode;
        }
      }
      if (node.canHaveChars && !node.structureIsKnown) {
        const charNodes = [];

        const chars = splitChars(node.value);
        for (const char of chars) {
          const charNode = _createValueNode({
            parentNode: node,
            type: "char",
            value: char,
          });
          const charNodeIndex = node.chars.length;
          charNode.index = charNodeIndex;
          charNodes[charNodeIndex] = charNode;
        }

        node.charNodes = charNodes;
      }

      // url parts
      if (node.isUrl || node.isUrlString) {
        const urlPartNodes = {};

        const urlParts = node.isUrl ? node.value : new URL(node.value);
        for (const urlPartName of URL_PART_NAMES) {
          const urlPartValue = urlParts[urlPartName];
          const urlPartNode = _createValueNode({
            parentNode: node,
            type: "url_part",
            value: normalizeUrlPart(urlPartName, urlPartValue),
          });
          urlPartNode.urlPartName = urlPartName;
          urlPartNodes[urlPartName] = urlPartNode;
        }

        node.urlPartNodes = urlPartNodes;
      }

      return node;
    };

    const valueNode = _createValueNode({
      type: "value",
      value,
    });
    return valueNode;
  };

  const visitPrototypes = (obj, callback) => {
    while (obj || isUndetectableObject(obj)) {
      const proto = Object.getPrototypeOf(obj);
      if (!proto) {
        break;
      }
      callback(proto);
      obj = proto;
    }
  };
  const getSubtype = (obj) => {
    // https://github.com/nodejs/node/blob/384fd1787634c13b3e5d2f225076d2175dc3b96b/lib/internal/util/inspect.js#L859
    const tag = obj[Symbol.toStringTag];
    if (typeof tag === "string") {
      return tag;
    }

    while (obj || isUndetectableObject(obj)) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, "constructor");
      if (
        descriptor !== undefined &&
        typeof descriptor.value === "function" &&
        descriptor.value.name !== ""
      ) {
        return String(descriptor.value.name);
      }
      obj = Object.getPrototypeOf(obj);
      if (obj === null) {
        return "Object";
      }
    }
    return "";
  };
  const isUndetectableObject = (v) =>
    typeof v === "undefined" && v !== undefined;

  // we could also just do sthing like if (indexedValues[property]) ?
  const isArrayIndex = (property) => {
    if (property === "NaN") {
      return false;
    }
    const asNumber = parseInt(property);
    if (asNumber < 0) {
      return false;
    }
    if (asNumber > 4_294_967_294) {
      return false;
    }
    if (asNumber % 1 !== 0) {
      // float
      return false;
    }
    return true;
  };

  const normalizeUrlPart = (name, value) => {
    if (name === "port") {
      if (value === "") {
        return "";
      }
      return parseInt(value);
    }
    if (name === "search") {
      return value.slice(1);
    }
    return value;
  };

  const URL_PART_NAMES = [
    "protocol",
    "username",
    "password",
    "hostname",
    "port",
    "pathname",
    // for search params I'll have to think about it
    // for now we'll handle it as a string
    "search",
    "hash",
  ];
}

let writeDiff;
{
  writeDiff = (node, context) => {
    // const valueInfo = node[context.resultType];
    const type = node.type;
    const method = methods[type];
    if (!method) {
      throw new Error(`unknown node type: ${type}`);
    }
    context.onNodeDisplayed(node);
    return method(node, context);
  };

  const writePropertyDiff = (node, context) => {
    if (context.collapsed) {
      if (
        node.descriptors.get[context.resultType].value &&
        node.descriptors.set[context.resultType].value
      ) {
        return writeDiff(node.descriptors.get, context);
      }
      if (node.descriptors.get[context.resultType].value) {
        return writeDiff(node.descriptors.get, context);
      }
      if (node.descriptors.set[context.resultType].value) {
        return writeDiff(node.descriptors.set, context);
      }
      return writeDiff(node.descriptors.value, context);
    }
    let propertyDiff = "";
    const descriptorNames = Object.keys(node.descriptors);
    for (const descriptorName of descriptorNames) {
      const descriptorNode = node.descriptors[descriptorName];
      if (descriptorNode) {
        propertyDiff += writeDiff(descriptorNode, context);
      }
    }
    return propertyDiff;
  };
  // prettier-ignore
  const charMeta = [
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

  const writeValueDiff = (comparison, context) => {
    const node = comparison[context.resultType];
    const relativeDepth = node.depth + context.initialDepth;
    const valueContext = {
      ...context,
    };
    if (!context.modified) {
      const hasUrlParts = node.isUrlString || node.isUrl;
      if (hasUrlParts && node.type === "url_part") {
        // the urls parts will display the diff
      } else if (node.asString && node.type === "as_string") {
        // as string will display the diff
      } else if (node.diff.counters.self.any > 0) {
        valueContext.modified = true;
      }
    }
    valueContext.insideOverview = valueContext.collapsed !== true;
    if (!valueContext.collapsed) {
      if (relativeDepth >= valueContext.maxDepth) {
        valueContext.collapsed = true;
      } else if (node.diff.counters.overall.any === 0) {
        valueContext.collapsed = true;
      }
    }

    if (node.wellKnownId) {
      const valueColor = getValueColor(valueContext);
      return ANSI.color(node.wellKnownId, valueColor);
    }
    if (node.isUrlString && node.canDiffUrlParts) {
      return writeCompositeDiff(node, valueContext, context);
    }
    if (node.isPrimitive) {
      if (node.asString && node.type === "as_string") {
        return writeLinesDiff(node.asString, valueContext, context);
      }
      const value = node.value;
      if (node.canHaveLines) {
        const string = value;
        if (valueContext.collapsed) {
          if (!comparison.quote && node.type !== "url_part") {
            const quote =
              context.quote === "auto" ? pickBestQuote(string) : context.quote;
            comparison.quote = quote; // ensure the quote in expected is "forced" to the one in actual
          }

          const remainingWidth =
            valueContext.maxColumns - valueContext.textIndent;
          let maxWidth = Math.min(remainingWidth, 20);
          if (node.quote) {
            const quoteWidth = node.quote.length;
            maxWidth -= quoteWidth + quoteWidth;
          }
          let stringDiff;
          const width = stringWidth(string);
          if (width > maxWidth) {
            stringDiff = string.slice(0, maxWidth - "…".length);
            stringDiff += "…";
          } else {
            stringDiff = string;
          }
          const valueColor = getValueColor(valueContext);
          let stringOverviewDiff = "";
          if (comparison.quote) {
            let quoteColor;
            let nodeForQuotes = node;
            if (node.type === "as_string") {
              nodeForQuotes = node.parent;
            }
            if (valueContext.removed) {
              quoteColor = removedColor;
            } else if (valueContext.added) {
              quoteColor = addedColor;
            } else if (valueContext.modified) {
              quoteColor =
                context.resultType === "actualNode"
                  ? unexpectedColor
                  : expectedColor;
            } else if (
              nodeForQuotes.actual.isComposite ===
              nodeForQuotes.expected.isComposite
            ) {
              quoteColor = sameColor;
            } else {
              quoteColor =
                context.resultType === "actualNode"
                  ? unexpectedColor
                  : expectedColor;
            }
            stringOverviewDiff += ANSI.color(node.quote, quoteColor);
            stringOverviewDiff += ANSI.color(stringDiff, valueColor);
            stringOverviewDiff += ANSI.color(node.quote, quoteColor);
          } else {
            stringOverviewDiff += ANSI.color(stringDiff, valueColor);
          }
          return stringOverviewDiff;
        }

        let stringDiff = "";
        valueContext.modified = node.canDiffLines
          ? context.modified
          : valueContext.modified;
        stringDiff += writeLinesDiff(node, valueContext, context);
        return stringDiff;
      }

      if (node.isString) {
        const valueColor = getValueColor(valueContext);
        const { preserveLineBreaks, quote } = valueContext;
        const char = node[valueContext.resultType].value;
        const point = char.charCodeAt(0);
        if (preserveLineBreaks && (char === "\n" || char === "\r")) {
          return ANSI.color(char, valueColor);
        }
        if (
          char === quote ||
          point === 92 ||
          point < 32 ||
          (point > 126 && point < 160) ||
          // line separators
          point === 8232 ||
          point === 8233
        ) {
          const replacement =
            char === quote
              ? `\\${quote}`
              : point === 8232
                ? "\\u2028"
                : point === 8233
                  ? "\\u2029"
                  : charMeta[point];
          return ANSI.color(replacement, valueColor);
        }
        return ANSI.color(char, valueColor);
      }

      let valueDiff =
        value === undefined
          ? "undefined"
          : value === null
            ? "null"
            : JSON.stringify(value);
      if (
        valueDiff.length >
        valueContext.maxColumns - valueContext.textIndent
      ) {
        valueDiff = valueDiff.slice(
          0,
          valueContext.maxColumns - valueContext.textIndent - "…".length,
        );
        valueDiff += "…";
      }
      const valueColor = getValueColor(valueContext);
      return ANSI.color(valueDiff, valueColor);
    }
    if (context.collapsed && node.type === "property_descriptor") {
      const valueColor = getValueColor(valueContext);
      if (node.descriptor === "get") {
        if (node.parent.descriptors.set[valueContext.resultType].value) {
          return ANSI.color("[get/set]", valueColor);
        }
        return ANSI.color("[get]", valueColor);
      }
      if (node.descriptor === "set") {
        if (node.parent.descriptors.get[valueContext.resultType].value) {
          return ANSI.color("[get/set]", valueColor);
        }
        return ANSI.color("[set]", valueColor);
      }
    }
    return writeCompositeDiff(node, valueContext, context);
  };

  const writeCompositeDiff = (comparison, context, parentContext) => {
    const node = comparison[context.resultType];
    const delimitersColor = getDelimitersColor(context);

    let compositeDiff = "";
    reference: {
      // referencing an other composite
      if (node.reference) {
        compositeDiff += ANSI.color(
          `<ref #${context.getDisplayedId(node.reference.id)}>`,
          delimitersColor,
        );
        return compositeDiff;
      }
      // will be referenced by a composite
      let referenceFromOtherDisplayed;
      for (const referenceFromOther of node.referenceFromOthersSet) {
        if (referenceFromOther[context.resultType].redundant) {
          continue;
        }
        referenceFromOtherDisplayed = referenceFromOther;
        break;
      }
      if (referenceFromOtherDisplayed) {
        compositeDiff += ANSI.color(
          `<ref #${context.getDisplayedId(
            referenceFromOtherDisplayed[context.resultType].reference.id,
          )}>`,
          delimitersColor,
        );
        compositeDiff += " ";
      }
    }
    inside: {
      if (context.collapsed) {
        if (context.insideOverview) {
          const overviewDiff = writeOverviewDiff(
            comparison,
            context,
            parentContext,
          );
          compositeDiff += overviewDiff;
        } else {
          const collapsedDiff = writeCollapsedDiff(
            comparison,
            context,
            parentContext,
          );
          compositeDiff += collapsedDiff;
        }
      } else {
        const expandedDiff = writeExpandedDiff(
          comparison,
          context,
          parentContext,
        );
        compositeDiff += expandedDiff;
      }
    }
    return compositeDiff;
  };
  const writeNestedValueDiff = (comparison, context) => {
    const node = comparison[context.resultType];
    if (node.type === "value_of_return_value" && node.inConstructor) {
      return writeValueDiff(node, context);
    }
    if (node.type === "as_string" && node.inConstructor) {
      return writeValueDiff(node, context);
    }
    if (
      node.type === "property_descriptor" &&
      isDefaultDescriptor(node.descriptor, node.value)
    ) {
      return "";
    }

    const nestedValueContext = getNestedValueContext(node, context);
    let nestedValueDiff = "";
    const relativeDepth = node.depth + nestedValueContext.initialDepth;
    let indent = `  `.repeat(relativeDepth);
    const keyColor = getKeyColor(nestedValueContext);
    const delimitersColor = getDelimitersColor(nestedValueContext);
    let displayValue = true;

    const useIndent =
      !nestedValueContext.collapsed &&
      (node.type === "indexed_value" ||
        node.type === "property_descriptor" ||
        node.type === "prototype" ||
        node.type === "value_of_return_value" ||
        node.type === "as_string");
    if (useIndent) {
      if (nestedValueContext.signs) {
        if (nestedValueContext.removed) {
          if (nestedValueContext.resultType === "expectedNode") {
            nestedValueDiff += ANSI.color(removedSign, removedSignColor);
            indent = indent.slice(1);
          }
        } else if (nestedValueContext.added) {
          if (nestedValueContext.resultType === "actualNode") {
            nestedValueDiff += ANSI.color(addedSign, addedSignColor);
            indent = indent.slice(1);
          }
        } else if (nestedValueContext.modified) {
          if (nestedValueContext.resultType === "actualNode") {
            nestedValueDiff += ANSI.color(unexpectedSign, unexpectedSignColor);
            indent = indent.slice(1);
          }
        }
      }
      nestedValueDiff += indent;
    }

    const property =
      node.type === "property_descriptor"
        ? node.property
        : node.type === "prototype"
          ? "__proto__" // "[[Prototype]]"?
          : node.type === "value_of_return_value"
            ? "valueOf()"
            : node.type === "to_string_return_value"
              ? "toString()"
              : "";
    if (property && node !== nestedValueContext.startComparison) {
      if (node.type === "property_descriptor" && node.descriptor !== "value") {
        nestedValueDiff += ANSI.color(node.descriptor, keyColor);
        nestedValueDiff += " ";
      }
      const propertyKeyFormatted = humanizePropertyKey(property);
      nestedValueDiff += ANSI.color(propertyKeyFormatted, keyColor);
      if (displayValue) {
        nestedValueDiff += ANSI.color(":", keyColor);
        nestedValueDiff += " ";
      }
    }
    let endSeparator;
    if (node.canHaveLines && node.lineNodes.length > 1) {
      // when using
      // foo: 1| line 1
      //      2| line 2
      //      3| line 3
      // the "," separator is removed because it's not correctly separated from the multiline
      // and it becomes hard to know if "," is part of the string or not
      endSeparator = "";
    } else if (useIndent && node !== nestedValueContext.startComparison) {
      endSeparator = ",";
    } else {
      endSeparator = "";
    }
    if (displayValue) {
      nestedValueContext.textIndent += stringWidth(nestedValueDiff);
      nestedValueContext.maxColumns -= endSeparator.length;
      if (nestedValueContext.modified) {
        nestedValueContext.maxDepth = Math.min(
          node.depth + nestedValueContext.maxDepthInsideDiff,
          nestedValueContext.maxDepth,
        );
      }
      const valueDiff = writeValueDiff(node, nestedValueContext);
      nestedValueDiff += valueDiff;
    }
    if (endSeparator) {
      nestedValueDiff += ANSI.color(endSeparator, delimitersColor);
    }
    return nestedValueDiff;
  };
  const writePrefix = (
    comparison,
    context,
    parentContext,
    { overview } = {},
  ) => {
    const node = comparison[context.resultType];
    let prefix = "";

    const displayValueOfInsideConstructor =
      node.isComposite &&
      // value returned by valueOf() is not the composite itself
      node.valueOfReturnValue &&
      node.valueOfReturnValue[context.resultType].inConstructor &&
      !node.valueOfReturnValue[context.resultType].redundant;
    let displaySubtype = true;
    if (overview) {
      displaySubtype = true;
    } else if (node.subtype === "Object" || node.subtype === "Array") {
      displaySubtype = false;
    } else if (node.type === "value_of_return_value") {
      const parentSubtype = node.parent[context.resultType].subtype;
      if (
        parentSubtype === "String" ||
        parentSubtype === "Number" ||
        parentSubtype === "Boolean"
      ) {
        displaySubtype = false;
      }
    }

    const delimitersColor = getDelimitersColor(context);

    if (displaySubtype) {
      let subtypeColor;
      if (context.added) {
        subtypeColor = addedColor;
      } else if (context.removed) {
        subtypeColor = removedColor;
      } else if (
        comparison.actualNode.isComposite &&
        comparison.expectedNode.isComposite &&
        comparison.actualNode.subtype === comparison.expectedNode.subtype
      ) {
        subtypeColor = sameColor;
      } else if (
        comparison.actualNode.isComposite ===
          comparison.expectedNode.isComposite &&
        comparison.actualNode.canHaveLines &&
        comparison.expectedNode.canHaveLines
      ) {
        subtypeColor = sameColor;
      } else {
        subtypeColor =
          context.resultType === "actualNode" ? unexpectedColor : expectedColor;
      }
      prefix += ANSI.color(node.subtype, subtypeColor);
    }
    if (node.isArray) {
      if (!overview) {
        return prefix;
      }
      prefix += ANSI.color(`(`, delimitersColor);
      let lengthColor = context.added
        ? addedColor
        : context.removed
          ? removedColor
          : comparison.actualNode.isArray &&
              comparison.expectedNode.isArray &&
              comparison.actualNode.value.length ===
                comparison.expectedNode.value.length
            ? sameColor
            : context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
      prefix += ANSI.color(node.value.length, lengthColor);
      prefix += ANSI.color(`)`, delimitersColor);
      return prefix;
    }
    if (node.isString) {
      if (!overview) {
        return prefix;
      }
      prefix += ANSI.color(`(`, delimitersColor);
      let lengthColor = context.added
        ? addedColor
        : context.removed
          ? removedColor
          : comparison.actualNode.isString &&
              comparison.expectedNode.isString &&
              comparison.actualNode.charNodes.length ===
                comparison.expectedNode.charNodes.length
            ? sameColor
            : context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
      prefix += ANSI.color(node.charNodes.length, lengthColor);
      prefix += ANSI.color(`)`, delimitersColor);
      return prefix;
    }
    if (node.isComposite) {
      let insideConstructor = "";
      const prefixWithNew =
        node.subtype === "String" ||
        node.subtype === "Boolean" ||
        node.subtype === "Number";
      if (prefixWithNew) {
        prefix = `${ANSI.color(`new`, delimitersColor)} ${prefix}`;
      }

      let openBracket = "(";
      let closeBracket = ")";

      if (displayValueOfInsideConstructor) {
        insideConstructor = writeDiff(node.valueOfReturnValue, parentContext);
        // if (overview) {
        //   insideConstructor = writeDiff(node.valueOfReturnValue, parentContext);
        // } else {
        //   insideConstructor = writeValueDiff(node.valueOfReturnValue, context);
        // }
      } else if (overview) {
        let overviewContent = node.isSet
          ? node.indexedValueNodes.length
          : node.keys.length;
        if (context.added) {
          insideConstructor = ANSI.color(overviewContent, addedColor);
        } else if (context.removed) {
          insideConstructor = ANSI.color(overviewContent, removedColor);
        } else if (
          comparison.actualNode.isSet &&
          comparison.expectedNode.isSet
        ) {
          if (context.resultType === "actualNode") {
            const added = comparison.actualNode.setValues.some(
              (setValueNode) => setValueNode.diff.added,
            );
            insideConstructor = ANSI.color(
              overviewContent,
              added ? addedColor : sameColor,
            );
          } else {
            const removed = comparison.expectedNode.setValues.some(
              (setValueNode) => setValueNode.diff.removed,
            );
            insideConstructor = ANSI.color(
              overviewContent,
              removed ? removedColor : sameColor,
            );
          }
        } else if (
          comparison.actualNode.isSet !== comparison.expectedNode.isSet
        ) {
          insideConstructor = ANSI.color(
            overviewContent,
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor,
          );
        } else if (
          comparison.actualNode.isComposite &&
          comparison.expectedNode.isComposite &&
          comparison.actualNode.keys.length ===
            comparison.expectedNode.keys.length
        ) {
          insideConstructor = ANSI.color(overviewContent, sameColor);
        } else {
          insideConstructor = ANSI.color(
            overviewContent,
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor,
          );
        }
      }
      if (insideConstructor) {
        prefix += ANSI.color(openBracket, delimitersColor);
        prefix += insideConstructor;
        prefix += ANSI.color(closeBracket, delimitersColor);
      }
      return prefix;
    }
    return prefix;
  };
  const writeOneLineDiff = (lineNode, context, parentContext) => {
    let { focusedCharIndex } = context;

    const lineValueInfo = lineNode[context.resultType];
    const chars = lineValueInfo.chars;
    const charNodes = lineNode.chars;
    const charBeforeArray = [];
    const charAfterArray = [];

    let remainingWidth = context.maxColumns - context.textIndent;
    const focusedCharNode = charNodes[focusedCharIndex];
    let focusedCharDiff;
    if (focusedCharNode) {
      focusedCharDiff = writeDiff(focusedCharNode, {
        ...context,
        modified: lineNode.canDiffChars
          ? parentContext.modified
          : context.modified,
      });
      remainingWidth -= stringWidth(focusedCharDiff);
    } else {
      focusedCharDiff = "";
      focusedCharIndex = chars.length - 1;
    }

    const leftOverflowBoilerplateWidth = "…".length;
    const rightOverflowBoilerplateWidth = "…".length;
    let tryBeforeFirst = true;
    let previousCharAttempt = 0;
    let nextCharAttempt = 0;
    while (remainingWidth) {
      let charIndex;
      const previousCharIndex = focusedCharIndex - previousCharAttempt - 1;
      const nextCharIndex = focusedCharIndex + nextCharAttempt + 1;
      let hasPreviousChar = previousCharIndex >= 0;
      const hasNextChar = nextCharIndex < chars.length;
      if (!hasPreviousChar && !hasNextChar) {
        break;
      }
      if (!tryBeforeFirst && hasNextChar) {
        hasPreviousChar = false;
      }
      if (hasPreviousChar) {
        previousCharAttempt++;
        charIndex = previousCharIndex;
      } else if (hasNextChar) {
        nextCharAttempt++;
        charIndex = nextCharIndex;
      }
      const charNode = charNodes[charIndex];
      if (!charNode) {
        continue;
      }
      if (tryBeforeFirst && hasPreviousChar) {
        tryBeforeFirst = false;
      }
      const charDiff = writeDiff(charNode, {
        ...context,
        modified: lineNode.canDiffChars
          ? parentContext.modified
          : context.modified,
      });
      const charWidth = stringWidth(charDiff);
      let nextWidth = charWidth;
      if (charIndex - 1 > 0) {
        nextWidth += leftOverflowBoilerplateWidth;
      }
      if (charIndex + 1 < chars.length - 1) {
        nextWidth += rightOverflowBoilerplateWidth;
      }
      if (nextWidth >= remainingWidth) {
        break;
      }
      if (charIndex < focusedCharIndex) {
        charBeforeArray.push(charDiff);
      } else {
        charAfterArray.push(charDiff);
      }
      remainingWidth -= charWidth;
    }

    let oneLineDiff = "";
    const delimitersColor = getDelimitersColor(context);
    const overflowLeft = focusedCharIndex - previousCharAttempt > 0;
    const overflowRight = focusedCharIndex + nextCharAttempt < chars.length - 1;
    if (overflowLeft) {
      oneLineDiff += ANSI.color("…", delimitersColor);
    }
    const parentNode = lineNode.parent;
    const bracketColor = getBracketColor(parentNode, context);
    if (parentNode.quote) {
      oneLineDiff += ANSI.color(parentNode.quote, bracketColor);
    }
    oneLineDiff += charBeforeArray.reverse().join("");
    oneLineDiff += focusedCharDiff;
    oneLineDiff += charAfterArray.join("");
    if (parentNode.quote) {
      oneLineDiff += ANSI.color(parentNode.quote, bracketColor);
    }
    if (overflowRight) {
      oneLineDiff += ANSI.color("…", delimitersColor);
    }
    return oneLineDiff;
  };
  const writeLinesDiff = (comparison, context, parentContext) => {
    const node = comparison[context.resultType];
    const lineNodes = node.lineNodes;
    empty_string: {
      const firstLineNode = lineNodes[0];
      if (firstLineNode.value === "") {
        const quote = node.quote || DOUBLE_QUOTE;
        const bracketColor = getBracketColor(node, context);
        let expandedDiff = "";
        expandedDiff += ANSI.color(quote, bracketColor);
        expandedDiff += ANSI.color(quote, bracketColor);
        return expandedDiff;
      }
    }

    single_line: {
      const isSingleLine = lineNodes.length === 1;
      // single line string (both actual and expected)
      if (!isSingleLine) {
        break single_line;
      }
      const firstLineNode = lineNodes[0];
      if (!comparison.quote && node.type !== "url_part") {
        const quote =
          context.quote === "auto" ? pickBestQuote(node.value) : context.quote;
        comparison.quote = quote; // ensure the quote in expected is "forced" to the one in actual
      }
      const focusedCharIndex = getFocusedCharIndex(firstLineNode, context);
      return writeOneLineDiff(
        firstLineNode,
        {
          ...context,
          removed:
            firstLineNode.diff.removed === undefined
              ? context.removed
              : firstLineNode.diff.removed,
          added:
            firstLineNode.diff.added === undefined
              ? context.added
              : firstLineNode.diff.added,
          modified: firstLineNode.canDiffChars
            ? parentContext.modified
            : context.modified,
          focusedCharIndex,
        },
        context,
      );
    }

    multiline: {
      let focusedLineIndex = lineNodes.findIndex((lineNode) => {
        return lineNode.diff.counters.overall.any > 0;
      });
      if (focusedLineIndex === -1) {
        focusedLineIndex = lineNodes.length - 1;
      }
      const focusedLineNode = lineNodes[focusedLineIndex];
      const focusedCharIndex = getFocusedCharIndex(focusedLineNode, context);
      let biggestLineNumber = focusedLineIndex + 1;

      const lineBeforeArray = [];
      let maxLineBefore = context.maxLineBeforeDiff - 1;
      while (maxLineBefore--) {
        const previousLineIndex = focusedLineIndex - lineBeforeArray.length - 1;
        const hasPreviousLine = previousLineIndex >= 0;
        if (!hasPreviousLine) {
          break;
        }
        const previousLineNode = lineNodes[previousLineIndex];
        lineBeforeArray.push(previousLineNode);
      }
      let previousLineRemaining = focusedLineIndex - lineBeforeArray.length;
      if (previousLineRemaining === 1) {
        lineBeforeArray.push(lineNodes[0]);
        previousLineRemaining = 0;
      }

      const lineAfterArray = [];
      let maxLineAfter = context.maxLineAfterDiff - 1;
      while (maxLineAfter--) {
        const nextLineIndex = focusedLineIndex + lineAfterArray.length + 1;
        const hasNextLine = nextLineIndex < lineNodes.length;
        if (!hasNextLine) {
          break;
        }
        const nextLineNode = lineNodes[nextLineIndex];
        lineAfterArray.push(nextLineNode);
        if (nextLineIndex + 1 > biggestLineNumber) {
          biggestLineNumber = nextLineIndex + 1;
        }
      }
      let nextLineRemaining =
        lineNodes.length - 1 - focusedLineIndex - lineAfterArray.length;
      if (nextLineRemaining === 1) {
        lineAfterArray.push(lineNodes[lineNodes.length - 1]);
        nextLineRemaining = 0;
      }

      const writeLineDiff = (lineNode) => {
        const lineContext = {
          ...context,
          removed:
            lineNode.diff.removed === undefined
              ? context.removed
              : lineNode.diff.removed,
          added:
            lineNode.diff.added === undefined
              ? context.added
              : lineNode.diff.added,
          modified: lineNode.canDiffChars
            ? parentContext.modified
            : context.modified,
          focusedCharIndex,
        };
        const delimitersColor = getDelimitersColor(lineContext);

        let lineDiff = "";
        const lineNumberString = String(lineNode.index + 1);
        if (String(biggestLineNumber).length > lineNumberString.length) {
          lineDiff += " ";
        }
        lineDiff += ANSI.color(lineNumberString, delimitersColor);
        // lineDiff += " ";
        lineDiff += ANSI.color("|", delimitersColor);
        lineDiff += " ";

        lineDiff += writeOneLineDiff(lineNode, lineContext, context);
        return lineDiff;
      };
      const diffLines = [];
      if (previousLineRemaining) {
        let previousLinesSkippedDiff = "";
        previousLinesSkippedDiff += " ".repeat(
          String(biggestLineNumber).length,
        );
        previousLinesSkippedDiff += ANSI.color(
          `↑ ${previousLineRemaining} lines ↑`,
          sameColor,
        );
        diffLines.push(previousLinesSkippedDiff);
      }
      for (const lineBeforeNode of lineBeforeArray) {
        diffLines.push(writeLineDiff(lineBeforeNode));
      }
      diffLines.push(writeLineDiff(focusedLineNode));
      for (const lineAfterNode of lineAfterArray) {
        diffLines.push(writeLineDiff(lineAfterNode));
      }
      if (nextLineRemaining) {
        const delimitersColor = getDelimitersColor(context);
        const skippedCounters = {
          total: 0,
          modified: 0,
        };
        const from = focusedLineIndex + lineAfterArray.length + 1;
        const to = lineNodes.length;
        let index = from;
        while (index < to) {
          const nextLineNode = lineNodes[index];
          index++;
          skippedCounters.total++;
          if (nextLineNode.diff.counters.overall.any > 0) {
            context.onNodeDisplayed(nextLineNode);
            skippedCounters.modified++;
            continue;
          }
        }
        let nextLinesSkippedDiff = "";
        nextLinesSkippedDiff += " ".repeat(String(biggestLineNumber).length);
        nextLinesSkippedDiff += ANSI.color("↓", delimitersColor);
        nextLinesSkippedDiff += " ";
        let belowSummary = "";
        let summaryColor = "";
        if (actualNode.lineNodes.length === expectedNode.lineNodes.length) {
          summaryColor = delimitersColor;
        } else if (context.resultType === "actualNode") {
          summaryColor = unexpectedColor;
        } else {
          summaryColor = expectedColor;
        }
        belowSummary += ANSI.color(
          `${skippedCounters.total} lines`,
          summaryColor,
        );
        const parts = [];
        if (skippedCounters.modified) {
          parts.push(
            ANSI.color(
              `${skippedCounters.modified} modified`,
              context.resultType === "actualNode"
                ? unexpectedColor
                : expectedColor,
            ),
          );
        }
        if (parts.length) {
          belowSummary += ` `;
          belowSummary += ANSI.color(`(`, delimitersColor);
          belowSummary += parts.join(" ");
          belowSummary += ANSI.color(`)`, delimitersColor);
        }
        nextLinesSkippedDiff += belowSummary;
        nextLinesSkippedDiff += " ";
        nextLinesSkippedDiff += ANSI.color("↓", delimitersColor);
        diffLines.push(nextLinesSkippedDiff);
      }
      let separator = `\n`;
      if (context.textIndent) {
        separator += " ".repeat(context.textIndent);
      }
      return diffLines.join(separator);
    }
  };

  const writeUrlDiff = (node, context, parentContext) => {
    const writeUrlPart = (name) => {
      const urlPartNode = node.urlParts[name];
      const urlPartValueInfo = urlPartNode[context.resultType];
      if (String(urlPartValueInfo.value) === "") {
        return "";
      }
      const urlPartDiff = writeDiff(urlPartNode, context, parentContext);
      return urlPartDiff;
    };

    let urlDiff = "";
    const bracketColor = getBracketColor(node, context);
    urlDiff += ANSI.color(`"`, bracketColor);
    urlDiff += writeUrlPart("protocol");
    const usernameDiff = writeUrlPart("username");
    if (usernameDiff) {
      urlDiff += usernameDiff;
    }
    const passwordDiff = writeUrlPart("password");
    if (passwordDiff) {
      const actualHasPassword = node.urlParts.password.actual.value.length;
      const expectedHasPassword = node.urlParts.password.expected.value.length;
      let passwordSeparatorColor;
      if (actualHasPassword && !expectedHasPassword) {
        passwordSeparatorColor = addedColor;
      } else if (!actualHasPassword && expectedHasPassword) {
        passwordSeparatorColor = removedColor;
      } else if (node.urlParts.password.diff.counters.overall.any) {
        passwordSeparatorColor =
          context.resultType === "actualNode" ? unexpectedColor : expectedColor;
      } else {
        passwordSeparatorColor = sameColor;
      }
      urlDiff += ANSI.color(":", passwordSeparatorColor);
      urlDiff += passwordDiff;
    }
    const hostnameDiff = writeUrlPart("hostname");
    if (hostnameDiff) {
      if (usernameDiff || passwordDiff) {
        const actualHasAuth =
          node.urlParts.username.actual.value.length ||
          node.urlParts.password.actual.value.length;
        const expectedHasAuth =
          node.urlParts.username.expected.value.length ||
          node.urlParts.password.expected.value.length;
        let authSeparatorColor;
        if (actualHasAuth && !expectedHasAuth) {
          authSeparatorColor = addedColor;
        } else if (!actualHasAuth && expectedHasAuth) {
          authSeparatorColor = removedColor;
        } else if (
          node.urlParts.password[context.resultType].length
            ? node.urlParts.password.diff.counters.overall.any
            : node.urlParts.username.diff.counters.overall.any
        ) {
          authSeparatorColor =
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
        } else {
          authSeparatorColor = sameColor;
        }
        urlDiff += ANSI.color("@", authSeparatorColor);
      }
      urlDiff += hostnameDiff;
    }
    const portDiff = writeUrlPart("port");
    if (portDiff) {
      if (hostnameDiff) {
        const actualHasPort = node.urlParts.port.actual.value.length > 0;
        const expectedHasPort =
          String(node.urlParts.port.expected.value).length > 0;
        let portSeparatorColor;
        if (actualHasPort && !expectedHasPort) {
          portSeparatorColor = addedColor;
        } else if (!actualHasPort && expectedHasPort) {
          portSeparatorColor = removedColor;
        } else if (node.urlParts.port.diff.counters.overall.any) {
          portSeparatorColor =
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
        } else {
          portSeparatorColor = sameColor;
        }
        urlDiff += ANSI.color(":", portSeparatorColor);
      }
      urlDiff += portDiff;
    }
    urlDiff += writeUrlPart("pathname");
    const searchDiff = writeUrlPart("search");
    if (searchDiff) {
      const actualHasSearch = node.urlParts.search.actual.value.length;
      const expectedHasSearch = node.urlParts.search.expected.value.length;
      let searchSeparatorColor;
      if (actualHasSearch && !expectedHasSearch) {
        searchSeparatorColor = addedColor;
      } else if (!actualHasSearch && expectedHasSearch) {
        searchSeparatorColor = removedColor;
      } else if (node.urlParts.search.diff.counters.overall.any) {
        searchSeparatorColor =
          context.resultType === "actualNode" ? unexpectedColor : expectedColor;
      } else {
        searchSeparatorColor = sameColor;
      }
      urlDiff += ANSI.color("?", searchSeparatorColor);
      urlDiff += searchDiff;
    }
    const hashDiff = writeUrlPart("hash");
    if (hashDiff) {
      const actualHasHash = node.urlParts.hash.actual.value.length;
      const expectedHasHash = node.urlParts.hash.expected.value.length;
      let hashSeparatorColor;
      if (actualHasHash && !expectedHasHash) {
        hashSeparatorColor = addedColor;
      } else if (!actualHasHash && expectedHasHash) {
        hashSeparatorColor = removedColor;
      } else if (node.urlParts.hash.diff.counters.overall.any) {
        hashSeparatorColor =
          context.resultType === "actualNode" ? unexpectedColor : expectedColor;
      } else {
        hashSeparatorColor = sameColor;
      }
      urlDiff += ANSI.color("#", hashSeparatorColor);
      urlDiff += hashDiff;
    }
    urlDiff += ANSI.color(`"`, bracketColor);
    return urlDiff;
  };

  const writeExpandedDiff = (comparison, context, parentContext) => {
    const node = comparison[context.resultType];
    if (node.isString && !node.isUrlString && node.canHaveLines) {
      return writeLinesDiff(node, context, parentContext);
    }
    if (node.type === "as_string") {
      return writeLinesDiff(node, context, parentContext);
    }

    const delimitersColor = getDelimitersColor(context);
    const relativeDepth = node.depth + context.initialDepth;
    let indent = "  ".repeat(relativeDepth);
    let diffCount = 0;

    const appendNestedValueDiff = (node, writeContext) => {
      let diff = writeDiff(node, {
        ...writeContext,
        textIndent: 0,
      });
      if (node !== context.startComparison) {
        diff += `\n`;
      }
      return diff;
    };

    const writeGroupDiff = (
      next,
      { openBracket, closeBracket, forceBracket, valueLabel },
    ) => {
      let groupDiff = "";
      const entryBeforeDiffArray = [];
      let skippedArray = [];
      let entry;
      while ((entry = next())) {
        if (context.resultType === "actualNode" && entry.node.diff.removed) {
          continue;
        }
        if (context.resultType === "expectedNode" && entry.node.diff.added) {
          continue;
        }
        if (entry.node.owner && entry.node.owner !== context.resultType) {
          // set values are handled as indexed values (array entries)
          // but they are quite special, because the index does not matter
          // only the value matters (except when comparsing set and array)
          // so an indexed value is created for each set in actual/expected
          // but we don't want to display value beloning to actual
          // in expected (and the other way around)
          continue;
        }
        if (!entry.node.diff.counters.overall.any) {
          entryBeforeDiffArray.push(entry);
          continue;
        }
        diffCount++;
        // too many diff
        if (diffCount > context.maxDiffPerObject) {
          skippedArray.push(entry);
          continue;
        }
        // not enough space remaining
        // first write nested value (prop, value) before the diff
        const entryBeforeDiffCount = entryBeforeDiffArray.length;
        if (entryBeforeDiffCount) {
          let beforeDiff = "";
          let from = Math.max(
            entryBeforeDiffCount - context.maxValueBeforeDiff + 1,
            0,
          );
          let to = entryBeforeDiffCount;
          let index = from;
          while (index !== to) {
            const entryBeforeDiff = entryBeforeDiffArray[index];
            beforeDiff += appendNestedValueDiff(
              entryBeforeDiff.node,
              entryBeforeDiff.writeContext,
            );
            index++;
          }
          skippedArray = entryBeforeDiffArray.slice(0, from);
          entryBeforeDiffArray.length = 0;

          let skipped = skippedArray.length;
          if (skipped) {
            let aboveSummary = "";
            aboveSummary += `${skipped} ${valueLabel}s`;
            groupDiff += `${indent}  `;
            const arrowSign = diffCount > 1 ? `↕` : `↑`;
            groupDiff += ANSI.color(
              `${arrowSign} ${aboveSummary} ${arrowSign}`,
              delimitersColor,
            );
            groupDiff += "\n";
          }
          groupDiff += beforeDiff;
          skippedArray.length = 0;
        }
        groupDiff += appendNestedValueDiff(entry.node, entry.writeContext);
      }

      skippedArray.push(...entryBeforeDiffArray);
      // now display the values after
      const skippedCount = skippedArray.length;
      if (skippedCount) {
        const maxValueAfter = Math.min(
          context.modified
            ? context.maxValueInsideDiff - 1
            : context.maxValueAfterDiff - 1,
          skippedArray.length,
        );
        let from = 0;
        let to = maxValueAfter;
        let index = from;
        while (index !== to) {
          const nextEntry = skippedArray[index];
          if (nextEntry.node.diff.counters.self.any) {
            break;
          }
          index++;
          groupDiff += appendNestedValueDiff(
            nextEntry.node,
            nextEntry.writeContext,
          );
        }
        skippedArray = skippedArray.slice(index);
      }
      remaining_summary: {
        if (skippedArray.length === 0) {
          break remaining_summary;
        }
        const skippedCounters = {
          total: 0,
          removed: 0,
          added: 0,
          modified: 0,
        };
        for (const skipped of skippedArray) {
          skippedCounters.total++;
          if (context.resultType === "actualNode") {
            if (skipped.node.diff.added) {
              context.onNodeDisplayed(skipped.node);
              skippedCounters.added++;
              continue;
            }
            if (skipped.node.diff.counters.overall.any) {
              context.onNodeDisplayed(skipped.node);
              skippedCounters.modified++;
              continue;
            }
            continue;
          }
          if (skipped.node.diff.removed) {
            context.onNodeDisplayed(skipped.node);
            skippedCounters.removed++;
          }
        }
        let belowSummary = "";
        if (skippedCounters.total) {
          belowSummary += ANSI.color(
            skippedCounters.total === 1
              ? `1 ${valueLabel}`
              : `${skippedCounters.total} ${valueLabel}s`,
            delimitersColor,
          );
          const parts = [];
          if (skippedCounters.removed) {
            parts.push(
              ANSI.color(`${skippedCounters.removed} removed`, removedColor),
            );
          }
          if (skippedCounters.added) {
            parts.push(
              ANSI.color(`${skippedCounters.added} added`, addedColor),
            );
          }
          if (skippedCounters.modified) {
            parts.push(
              ANSI.color(
                `${skippedCounters.modified} modified`,
                context.resultType === "actualNode"
                  ? unexpectedColor
                  : expectedColor,
              ),
            );
          }
          if (parts.length) {
            belowSummary += ` `;
            belowSummary += ANSI.color(`(`, delimitersColor);
            belowSummary += parts.join(" ");
            belowSummary += ANSI.color(`)`, delimitersColor);
          }
        }
        groupDiff += `${indent}  `;
        groupDiff += ANSI.color(`↓`, delimitersColor);
        groupDiff += " ";
        groupDiff += belowSummary;
        groupDiff += " ";
        groupDiff += ANSI.color(`↓`, delimitersColor);
        groupDiff += "\n";
      }
      if (context.signs) {
        if (context.resultType === "actual") {
          if (context.added) {
            groupDiff += ANSI.color(addedSign, addedSignColor);
            indent = indent.slice(1);
          } else if (context.modified) {
            groupDiff += ANSI.color(unexpectedSign, unexpectedSignColor);
            indent = indent.slice(1);
          }
        } else if (context.removed) {
          groupDiff += ANSI.color(removedSign, removedSignColor);
          indent = indent.slice(1);
        }
      }
      if (groupDiff) {
        if (node.isComposite) {
          groupDiff = `\n${groupDiff}`;
          groupDiff += indent;
        }
      }
      let finalGroupDiff = "";
      if (forceBracket || groupDiff.length > 0) {
        const bracketColor = getBracketColor(node, context);
        finalGroupDiff += ANSI.color(openBracket, bracketColor);
        finalGroupDiff += groupDiff;
        finalGroupDiff += ANSI.color(closeBracket, bracketColor);
      } else {
        finalGroupDiff = groupDiff;
      }
      return finalGroupDiff;
    };

    let insideDiff = "";
    let prefix = "";
    if (!node.isUrlString) {
      prefix = writePrefix(node, context, parentContext);
      insideDiff += prefix;
    }

    if (node.isUrl || node.isUrlString) {
      let urlDiff;
      if (node.canDiffUrlParts) {
        urlDiff = writeUrlDiff(node, context, parentContext);
      } else {
        urlDiff = writeDiff(node.asString, context, parentContext);
      }

      if (node.isUrl) {
        let parenthesisColor;
        if (
          comparison.actualNode.isComposite ===
          comparison.expectedNode.isComposite
        ) {
          parenthesisColor = sameColor;
        } else {
          parenthesisColor =
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
        }
        insideDiff += ANSI.color("(", parenthesisColor);
        insideDiff += urlDiff;
        insideDiff += ANSI.color(")", parenthesisColor);
      } else {
        insideDiff += urlDiff;
      }
    }

    if (node.canHaveIndexedValues) {
      const indexedValueDiff = writeGroupDiff(
        createGetIndexedValues(node, context, parentContext),
        {
          valueLabel: "value",
          forceBracket: true,
          openBracket: "[",
          closeBracket: "]",
        },
      );
      if (node.isSet) {
        insideDiff += ANSI.color("(", delimitersColor);
      }
      if (indexedValueDiff) {
        insideDiff += indexedValueDiff;
      }
      if (node.isSet) {
        insideDiff += ANSI.color(")", delimitersColor);
      }
    }
    if (!node.isUrlString) {
      const propsDiff = writeGroupDiff(
        createGetProps(node, context, parentContext),
        {
          valueLabel: "prop",
          forceBracket: !node.canHaveIndexedValues && prefix.length === 0,
          openBracket: "{",
          closeBracket: "}",
        },
      );
      if (propsDiff) {
        if (insideDiff) {
          insideDiff += " ";
        }
        insideDiff += propsDiff;
      }
    }
    return insideDiff;
  };
  const writeOverviewDiff = (comparison, context, parentContext) => {
    const node = comparison[context.resultType];
    const prefixWithOverview = writePrefix(comparison, context, parentContext, {
      overview: true,
    });
    const delimitersColor = getDelimitersColor(context);
    const bracketColor = getBracketColor(node, context);
    const valueColor = getValueColor(context);
    const {
      openBracket,
      closeBracket,
      nestedValueSeparator,
      nestedValueSpacing,
      ellipsis,
    } = getDelimiters(node, context);

    const estimatedCollapsedBoilerplate = `${prefixWithOverview} ${openBracket}${nestedValueSeparator} ${ellipsis}${closeBracket}`;
    const estimatedCollapsedBoilerplateWidth = stringWidth(
      estimatedCollapsedBoilerplate,
    );
    const remainingWidth =
      context.maxColumns -
      context.textIndent -
      estimatedCollapsedBoilerplateWidth;

    let insideOverview = "";
    let isFirst = true;
    let width = 0;
    let entry;
    const next = createGetNextNestedValue(node, context, parentContext);
    while ((entry = next())) {
      if (context.resultType === "actualNode" && entry.node.diff.removed) {
        continue;
      }
      if (context.resultType === "expectedNode" && entry.node.diff.added) {
        continue;
      }
      let valueOverview = "";
      valueOverview += writeDiff(entry.node, entry.writeContext);
      const valueWidth = stringWidth(valueOverview);
      if (width + valueWidth > remainingWidth) {
        let overview = "";
        overview += prefixWithOverview;
        overview += " ";
        overview += ANSI.color(openBracket, delimitersColor);
        if (insideOverview) {
          overview += " ";
          overview += insideOverview;
          if (nestedValueSeparator) {
            overview += ANSI.color(nestedValueSeparator, delimitersColor);
            if (nestedValueSpacing) {
              overview += " ";
            }
          }
        }
        overview += ANSI.color(ellipsis, valueColor);
        if (nestedValueSpacing) {
          overview += " ";
        }
        overview += ANSI.color(closeBracket, delimitersColor);
        return overview;
      }
      if (nestedValueSeparator) {
        if (isFirst) {
          isFirst = false;
        } else {
          insideOverview += ANSI.color(nestedValueSeparator, delimitersColor);
          width += nestedValueSeparator.length;
          if (nestedValueSpacing) {
            insideOverview += " ";
            width += " ".length;
          }
        }
      }
      insideOverview += valueOverview;
      width += valueWidth;
    }

    let overview = "";
    const prefix = writePrefix(node, context, parentContext);
    overview += prefix;

    let afterPrefix = "";
    const shouldDisplayBrackets = prefix ? insideOverview.length > 0 : true;
    if (shouldDisplayBrackets) {
      afterPrefix += ANSI.color(openBracket, bracketColor);
      if (insideOverview) {
        if (nestedValueSpacing) {
          afterPrefix += " ";
        }
        afterPrefix += insideOverview;
        if (nestedValueSpacing) {
          afterPrefix += " ";
        }
      }
      afterPrefix += ANSI.color(closeBracket, bracketColor);
    } else {
      afterPrefix = insideOverview;
    }
    if (prefix && afterPrefix) {
      overview += " ";
    }
    overview += afterPrefix;
    return overview;
  };
  const writeCollapsedDiff = (node, context, parentContext) => {
    return writePrefix(node, context, parentContext, {
      overview: true,
    });
  };
  const createGetNextNestedValue = (node, context, parentContext) => {
    const nextIndexedValue = createGetIndexedValues(
      node,
      context,
      parentContext,
    );
    const nextProp = createGetProps(node, context, parentContext);
    return () => {
      const indexedValue = nextIndexedValue();
      if (indexedValue) {
        return indexedValue;
      }
      return nextProp();
    };
  };
  const createGetIndexedValues = (node, context, parentContext) => {
    const valueInfo = node[context.resultType];
    const indexedValueCount = valueInfo.canHaveIndexedValues
      ? node.indexedValues.length
      : 0;
    let indexedValueIndex = 0;
    return () => {
      if (indexedValueIndex < indexedValueCount) {
        const indexedValueNode = node.indexedValues[indexedValueIndex];
        indexedValueIndex++;
        return {
          node: indexedValueNode,
          writeContext: {
            ...context,
            modified: node.canDiffIndexedValues
              ? parentContext.modified
              : context.modified,
          },
        };
      }
      return null;
    };
  };
  const createGetProps = (node, context, parentContext) => {
    const valueInfo = node[context.resultType];
    const propertyNames = valueInfo.canHaveProps ? valueInfo.keys : [];
    const propertyCount = propertyNames.length;
    let valueOfReturnValueDisplayed = false;
    let prototypeDisplayed = false;
    let propIndex = 0;

    return () => {
      if (
        !valueOfReturnValueDisplayed &&
        node.valueOfReturnValue &&
        !node.valueOfReturnValue[context.resultType].inConstructor &&
        !node.valueOfReturnValue[context.resultType].redundant
      ) {
        valueOfReturnValueDisplayed = true;
        return {
          node: node.valueOfReturnValue,
          writeContext: {
            ...context,
            modified: node.canDiffValueOfReturnValue
              ? parentContext.modified
              : context.modified,
          },
        };
      }
      if (
        !prototypeDisplayed &&
        valueInfo.isComposite &&
        node.diff.prototype &&
        node.diff.prototype.counters.overall.any > 0 &&
        !node.prototypeAreDifferentAndWellKnown
      ) {
        prototypeDisplayed = true;
        return {
          node: node.prototype,
          writeContext: {
            ...context,
            modified: node.canDiffPrototypes
              ? parentContext.modified
              : context.modified,
          },
        };
      }
      if (propIndex < propertyCount) {
        const propertyNode = node.properties[propertyNames[propIndex]];
        propIndex++;
        return {
          node: propertyNode,
          writeContext: {
            ...context,
            modified: node.canDiffProps
              ? parentContext.modified
              : context.modified,
          },
        };
      }
      return null;
    };
  };

  const methods = {
    value: writeValueDiff,
    property: writePropertyDiff,
    char: writeNestedValueDiff,
    prototype: writeNestedValueDiff,
    value_of_return_value: writeNestedValueDiff,
    as_string: writeNestedValueDiff,
    indexed_value: writeNestedValueDiff,
    property_descriptor: writeNestedValueDiff,
    url_part: writeNestedValueDiff,
  };

  const getNestedValueContext = (node, context) => {
    // const valueInfo = node[context.resultType];
    const nestedValueContext = { ...context };
    if (node.diff.removed) {
      nestedValueContext.removed = true;
    }
    if (node.diff.added) {
      nestedValueContext.added = true;
    }
    if (node.type === "property_descriptor") {
      if (node.parent.diff.removed) {
        nestedValueContext.removed = true;
      }
      if (node.parent.diff.added) {
        nestedValueContext.added = true;
      }
    }
    return nestedValueContext;
  };
  const getDelimiters = (node, context) => {
    const valueInfo = node[context.resultType];
    if (valueInfo.isArray) {
      return {
        openBracket: "[",
        closeBracket: "]",
        nestedValueSeparator: ",",
        ellipsis: "...",
      };
    }
    if (valueInfo.isComposite) {
      return {
        openBracket: "{",
        closeBracket: "}",
        nestedValueSeparator: ",",
        nestedValueSpacing: true,
        ellipsis: "...",
      };
    }
    if (valueInfo.canHaveLines) {
      return {
        openBracket: `${node.index + 1} | `,
        closeBracket: "",
      };
    }
    if (valueInfo.canHaveChars) {
      return {
        nestedValueSeparator: "",
        ellipsis: "...",
      };
    }
    return null;
  };
  const getDelimitersColor = (context) => {
    if (context.resultType === "actualNode") {
      if (context.added) {
        return addedColor;
      }
      if (context.modified) {
        return unexpectedColor;
      }
      return sameColor;
    }
    if (context.removed) {
      return removedColor;
    }
    if (context.modified) {
      return expectedColor;
    }
    return sameColor;
  };
  const getKeyColor = (context) => {
    if (context.resultType === "actualNode") {
      if (context.added) {
        return addedColor;
      }
      if (context.modified) {
        return unexpectedColor;
      }
      return sameColor;
    }
    if (context.removed) {
      return removedColor;
    }
    if (context.modified) {
      return expectedColor;
    }
    return sameColor;
  };
  const getValueColor = (context) => {
    if (context.removed) {
      return removedColor;
    }
    if (context.added) {
      return addedColor;
    }
    if (context.modified) {
      if (context.resultType === "actualNode") {
        return unexpectedColor;
      }
      return expectedColor;
    }
    return sameColor;
  };
  const getBracketColor = (comparison, context) => {
    if (context.removed) {
      return removedColor;
    }
    if (context.added) {
      return addedColor;
    }
    if (context.modified) {
      if (
        comparison.actualNode.isComposite &&
        comparison.expectedNode.isComposite
      ) {
        const actualOpenBracket =
          comparison.actualNode.isArray || comparison.actualNode.isSet
            ? "["
            : "{";
        const expectedOpenBracket =
          comparison.expectedNode.isArray || comparison.expectedNode.isSet
            ? "["
            : "{";
        if (actualOpenBracket === expectedOpenBracket) {
          // they use same brackets
          return sameColor;
        }
      }
      if (comparison.actualNode.isString && comparison.expectedNode.isString) {
        // they use same brackets
        return sameColor;
      }
      if (context.resultType === "actualNode") {
        return unexpectedColor;
      }
      return expectedColor;
    }
    return sameColor;
  };
  const DOUBLE_QUOTE = `"`;
  const SINGLE_QUOTE = `'`;
  const BACKTICK = "`";
  const pickBestQuote = (
    string,
    { canUseTemplateString, quoteDefault = DOUBLE_QUOTE } = {},
  ) => {
    const containsDoubleQuote = string.includes(DOUBLE_QUOTE);
    if (!containsDoubleQuote) {
      return DOUBLE_QUOTE;
    }
    const containsSimpleQuote = string.includes(SINGLE_QUOTE);
    if (!containsSimpleQuote) {
      return SINGLE_QUOTE;
    }
    if (canUseTemplateString) {
      const containsBackTick = string.includes(BACKTICK);
      if (!containsBackTick) {
        return BACKTICK;
      }
    }
    const doubleQuoteCount = string.split(DOUBLE_QUOTE).length - 1;
    const singleQuoteCount = string.split(SINGLE_QUOTE).length - 1;
    if (singleQuoteCount > doubleQuoteCount) {
      return DOUBLE_QUOTE;
    }
    if (doubleQuoteCount > singleQuoteCount) {
      return SINGLE_QUOTE;
    }
    return quoteDefault;
  };

  const isDefaultDescriptor = (descriptorName, descriptorValue) => {
    if (descriptorName === "enumerable" && descriptorValue === true) {
      return true;
    }
    if (descriptorName === "writable" && descriptorValue === true) {
      return true;
    }
    if (descriptorName === "configurable" && descriptorValue === true) {
      return true;
    }
    if (descriptorName === "get" && descriptorValue === undefined) {
      return true;
    }
    if (descriptorName === "set" && descriptorValue === undefined) {
      return true;
    }
    return false;
  };
}

const isComposite = (value) => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};
const humanizePropertyKey = (property) => {
  if (typeof property === "symbol") {
    return humanizeSymbol(property);
  }
  if (typeof property === "string") {
    return humanizePropertyName(property);
  }
  return property;
};
const humanizePropertyName = (propertyName) => {
  if (isDotNotationAllowed(propertyName)) {
    return propertyName;
  }
  return `"${propertyName}"`; // TODO: proper quote escaping
};
const humanizeSymbol = (symbol) => {
  const symbolWellKnownId = getWellKnownId(symbol);
  if (symbolWellKnownId) {
    return symbolWellKnownId;
  }
  const description = symbolToDescription(symbol);
  if (description) {
    const key = Symbol.keyFor(symbol);
    if (key) {
      return `Symbol.for(${description})`;
    }
    return `Symbol(${description})`;
  }
  return `Symbol()`;
};
const isDotNotationAllowed = (propertyName) => {
  return (
    /^[a-z_$]+[0-9a-z_&]$/i.test(propertyName) ||
    /^[a-z_$]$/i.test(propertyName)
  );
};
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
const createValuePath = (path = "") => {
  return {
    toString: () => path,
    valueOf: () => path,
    append: (property, { special } = {}) => {
      let propertyKey = "";
      let propertyKeyCanUseDot = false;
      if (typeof property === "symbol") {
        propertyKey = humanizeSymbol(property);
      } else if (typeof property === "string") {
        if (isDotNotationAllowed(property)) {
          propertyKey = property;
          propertyKeyCanUseDot = true;
        } else {
          propertyKey = `"${property}"`;
        }
      } else {
        propertyKey = String(property);
        propertyKeyCanUseDot = true;
      }
      let propertyPathString;
      if (path) {
        if (special) {
          propertyPathString += `${path}[[${propertyKey}]]`;
        } else if (propertyKeyCanUseDot) {
          propertyPathString = `${path}.${propertyKey}`;
        } else {
          propertyPathString += `${path}[${propertyKey}]`;
        }
      } else {
        propertyPathString = propertyKey;
      }
      return createValuePath(propertyPathString);
    },
  };
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
let getWellKnownId;
{
  const wellKnownWeakMap = new WeakMap();
  const symbolWellKnownMap = new Map();
  getWellKnownId = (value) => {
    if (!wellKnownWeakMap.size) {
      addWellKnownComposite(global);
    }
    if (typeof value === "symbol") {
      return symbolWellKnownMap.get(value);
    }
    return wellKnownWeakMap.get(value);
  };
  const addWellKnownComposite = (value) => {
    const visitValue = (value, valuePath) => {
      if (typeof value === "symbol") {
        symbolWellKnownMap.set(value, String(valuePath));
        return;
      }
      if (!isComposite(value)) {
        return;
      }

      if (wellKnownWeakMap.has(value)) {
        // prevent infinite recursion on circular structures
        return;
      }
      wellKnownWeakMap.set(value, String(valuePath));

      const visitProperty = (property) => {
        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, property);
        } catch (e) {
          // may happen if you try to access some iframe properties or stuff like that
          if (e.name === "SecurityError") {
            return;
          }
          throw e;
        }
        if (!descriptor) {
          return;
        }
        // do not trigger getter/setter
        if ("value" in descriptor) {
          const propertyValue = descriptor.value;
          visitValue(propertyValue, valuePath.append(property));
        }
      };
      for (const property of Object.getOwnPropertyNames(value)) {
        visitProperty(property);
      }
      for (const symbol of Object.getOwnPropertySymbols(value)) {
        visitProperty(symbol);
      }
    };
    visitValue(value, createValuePath());
  };
}

const splitChars = (string) => {
  // eslint-disable-next-line new-cap
  const splitter = new Graphemer.default();
  return splitter.splitGraphemes(string);
};

const getFocusedCharIndex = (node, context) => {
  const chars = node[context.resultType].chars;
  const charNodes = node.chars;
  const charWithDiffIndex = chars.findIndex((char, index) => {
    const charNode = charNodes[index];
    return charNode.diff.counters.overall.any > 0;
  });
  if (charWithDiffIndex !== -1) {
    return charWithDiffIndex;
  }

  return chars.length - 1;
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
