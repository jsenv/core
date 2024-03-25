import stringWidth from "string-width";
import Graphemer from "graphemer";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isAssertionError, createAssertionError } from "./assertion_error.js";

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
      colors = true,
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
    if (!colors) {
      ANSI.supported = false;
    }
    const maxValueBeforeDiff = maxValueAroundDiff;
    const maxValueAfterDiff = maxValueAroundDiff;
    const maxLineBeforeDiff = maxLineAroundDiff;
    const maxLineAfterDiff = maxLineAroundDiff;

    actualIsFirst = true;

    // actualIsFirst =
    //   Object.keys(firstArg).indexOf("actual") <
    //   Object.keys(firstArg).indexOf("expected");
    const actualReferenceMap = new Map();
    const getActualReference = (value, node) => {
      const reference = actualReferenceMap.get(value);
      if (reference) {
        reference.referenceFromOthersSet.add(node);
      } else {
        actualReferenceMap.set(value, node);
      }
      return reference;
    };
    const actualNode = createValueNode({
      name: "actual",
      value: actual,
      getReference: getActualReference,
    });
    const expectedReferenceMap = new Map();
    const getExpectedReference = (value, node) => {
      const reference = expectedReferenceMap.get(value);
      if (reference) {
        reference.referenceFromOthersSet.add(node);
      } else {
        expectedReferenceMap.set(value, node);
      }
      return reference;
    };
    const expectedNode = createValueNode({
      name: "expected",
      value: expected,
      getReference: getExpectedReference,
    });
    const causeCounters = {
      total: 0,
      displayed: 0,
    };
    const causeSet = new Set();
    const addCause = (comparison) => {
      if (shouldIgnoreComparison(comparison)) {
        return;
      }
      causeCounters.total++;
      causeSet.add(comparison);
    };
    const onComparisonDisplayed = (comparison) => {
      if (causeSet.has(comparison)) {
        causeSet.delete(comparison);
        causeCounters.displayed++;
      }
      if (comparison.type === "property") {
        // happens when node is skipped
        // in that case we want to consider all child nodes as displayed
        // (they are "displayed" in the summary)
        const propertyDescriptorComparisons =
          comparison.propertyDescriptorComparisons;
        for (const propertyDescriptorName of Object.keys(
          propertyDescriptorComparisons,
        )) {
          const propertyDescriptorComparison =
            propertyDescriptorComparisons[propertyDescriptorName];
          if (propertyDescriptorComparison) {
            onComparisonDisplayed(propertyDescriptorComparison);
          }
        }
      }
    };

    const settleCounters = (comparison) => {
      const { counters } = comparison;
      const { self, inside, overall } = counters;
      self.any = self.modified + self.removed + self.added;
      inside.any = inside.modified + inside.removed + inside.added;
      overall.removed = self.removed + inside.removed;
      overall.added = self.added + inside.added;
      overall.modified = self.modified + inside.modified;
      overall.any = self.any + inside.any;

      comparison.removed = self.removed > 0;
      comparison.added = self.added > 0;
      comparison.modified = self.modified > 0;
    };
    const appendCounters = (counter, otherCounter) => {
      counter.any += otherCounter.any;
      counter.removed += otherCounter.removed;
      counter.added += otherCounter.added;
      counter.modified += otherCounter.modified;
    };

    const compare = (comparison, context = {}) => {
      // ignoreDiff is meant to ignore the diff between actual/expected
      // (usually because comparison cannot be made (added,removed, visiting something different))
      // but the structure still have to be visited (properties, values, valueOf, ...)
      const doCompare = () => {
        const { actualNode, expectedNode } = comparison;

        const compareInside = (insideComparison, insideContext = {}) => {
          compare(insideComparison, { ...context, ...insideContext });
          if (insideComparison.counters.overall.any) {
            appendCounters(
              comparison.counters.inside,
              insideComparison.counters.overall,
            );
          }
        };

        if (comparison.type === "property") {
          if (!actualNode) {
            comparison.removed = true;
            comparison.counters.self.removed++;
          }
          if (!expectedNode) {
            comparison.added = true;
            comparison.counters.self.added++;
          }
          const visitPropertyDescriptor = (descriptorName) => {
            const actualPropertyDescriptorNode = actualNode
              ? actualNode.descriptorNodes[descriptorName]
              : null;
            const expectedPropertyDescriptorNode = expectedNode
              ? expectedNode.descriptorNodes[descriptorName]
              : null;
            if (
              !actualPropertyDescriptorNode &&
              !expectedPropertyDescriptorNode
            ) {
              return;
            }
            const propertyDescriptorComparison = createComparison(
              actualPropertyDescriptorNode,
              expectedPropertyDescriptorNode,
            );
            comparison.propertyDescriptorComparisons[descriptorName] =
              propertyDescriptorComparison;
            compareInside(propertyDescriptorComparison);
          };
          visitPropertyDescriptor("value");
          visitPropertyDescriptor("enumerable");
          visitPropertyDescriptor("writable");
          visitPropertyDescriptor("configurable");
          visitPropertyDescriptor("set");
          visitPropertyDescriptor("get");
          return;
        }

        if (!actualNode) {
          comparison.removed = true;
          comparison.counters.self.removed++;
          addCause(comparison);
          return;
        }
        if (!expectedNode) {
          comparison.added = true;
          comparison.counters.self.added++;
          addCause(comparison);
          return;
        }

        const addSelfDiff = () => {
          comparison.counters.self.modified++;
          addCause(comparison);
        };
        const addCategoryDiff = () => {
          comparison.category = true;
          if (actualNode.isUrlString && expectedNode.isUrlString) {
            return;
          }
          addSelfDiff();
        };

        let compareAsStrings;
        if (context.ignoreDiff) {
          compareAsStrings = false;
        } else if (actualNode.isUrl && expectedNode.isString) {
          compareAsStrings = true;
          addSelfDiff();
        } else if (expectedNode.isUrl && actualNode.isString) {
          compareAsStrings = true;
          addSelfDiff();
        } else {
          compareAsStrings = false;
        }
        let ignoreReferenceDiff = context.ignoreDiff || compareAsStrings;
        let ignoreCategoryDiff = context.ignoreDiff || compareAsStrings;
        let ignorePrototypeDiff = context.ignoreDiff;
        let ignoreValueOfReturnValueDiff = compareAsStrings;

        reference: {
          if (ignoreReferenceDiff) {
            break reference;
          }
          const actualReferencePath = actualNode.reference
            ? actualNode.reference.path.toString()
            : null;
          const expectedReferencePath = expectedNode.reference
            ? expectedNode.reference.path.toString()
            : null;
          if (actualReferencePath !== expectedReferencePath) {
            comparison.reference = true;
            addSelfDiff();
          }
        }
        category: {
          if (ignoreCategoryDiff) {
            break category;
          }
          if (actualNode.wellKnownId !== expectedNode.wellKnownId) {
            addCategoryDiff();
            break category;
          }
          const actualIsPrimitive = actualNode.isPrimitive;
          const expectedIsPrimitive = expectedNode.isPrimitive;
          if (actualIsPrimitive !== expectedIsPrimitive) {
            addCategoryDiff();
            break category;
          }
          if (
            actualIsPrimitive &&
            expectedIsPrimitive &&
            actualNode.value !== expectedNode.value
          ) {
            addCategoryDiff();
            break category;
          }
          const actualIsComposite = actualNode.isComposite;
          const expectedIsComposite = expectedNode.isComposite;
          if (actualIsComposite !== expectedIsComposite) {
            addCategoryDiff();
            break category;
          }
          const actualSubtype = actualNode.subtype;
          const expectedSubtype = expectedNode.subtype;
          if (actualSubtype !== expectedSubtype) {
            addCategoryDiff();
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
            comparison.prototypeComparison = prototypeComparison;
            compareInside(prototypeComparison);
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
            comparison.valueOfReturnValueComparison =
              valueOfReturnValueComparison;
            compareInside(valueOfReturnValueComparison);
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
            comparison.asStringComparison = asStringComparison;
            compareInside(asStringComparison);
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
                comparison.lineComparisons[lineIndex] = lineComparison;
                compareInside(lineComparison);
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
                comparison.charComparisons[charNodeIndex] = charComparison;
                compareInside(charComparison);
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
              const urlPartComparison = createComparison(
                actualUrlPartNode,
                expectedUrlPartNode,
              );
              comparison.urlPartComparisons[urlPartName] = urlPartComparison;
              compareInside(urlPartComparison);
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
                comparison.indexedValueComparisons[index] =
                  indexedValueComparison;
                compareInside(indexedValueComparison, {
                  ignoreDiff: true,
                });
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
              comparison.indexedValueComparisons[index] =
                indexedValueComparison;
              compareInside(indexedValueComparison);
            };
            for (const expectedIndexedValueNode of expectedIndexedValueNodes) {
              visitIndexedValue(expectedIndexedValueNode);
            }
            let index = 0;
            for (const actualIndexedValueNode of actualIndexedValueNodes) {
              if (!comparison.indexedValueComparisons[index]) {
                visitIndexedValue(actualIndexedValueNode);
              }
              index++;
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
              comparison.propertyComparisons[property] = propertyNodeComparison;
              compareInside(propertyNodeComparison);
            };
            for (const actualPropertyName of Object.keys(actualPropertyNodes)) {
              visitProperty(actualPropertyName);
            }
            for (const expectedPropertyName of Object.keys(
              expectedPropertyNodes,
            )) {
              if (!comparison.propertyComparisons[expectedPropertyName]) {
                visitProperty(expectedPropertyName);
              }
            }
          }
        }
      };

      doCompare();
      settleCounters(comparison);
    };
    const createComparison = (actualNode, expectedNode) => {
      if (actualNode && actualNode.comparison) {
        throw new Error("nope");
      }
      if (expectedNode && expectedNode.comparison) {
        throw new Error("nope");
      }

      const leftOrRightValueNode = actualNode || expectedNode;
      const parent = leftOrRightValueNode.parent
        ? leftOrRightValueNode.parent.comparison
        : null;
      const comparison = {
        parent,
        type: leftOrRightValueNode.type,
        depth: leftOrRightValueNode.depth,
        property: leftOrRightValueNode.property,
        descriptor: leftOrRightValueNode.descriptor,
        index: leftOrRightValueNode.index,

        actualNode,
        expectedNode,
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
        removed: false,
        added: false,
        modified: false,
        // comparisons
        reference: false,
        category: false,
        prototypeComparison: null,
        valueOfReturnValueComparison: null,
        asStringComparison: null,
        propertyComparisons: {},
        propertyDescriptorComparisons: {},
        indexedValueComparisons: [],
        lineComparisons: [],
        charComparisons: [],
        urlPartComparisons: {},
      };
      if (actualNode) {
        actualNode.comparison = comparison;
      }
      if (expectedNode) {
        expectedNode.comparison = comparison;
      }
      return comparison;
    };

    const rootComparison = createComparison(actualNode, expectedNode);
    compare(rootComparison);
    if (causeSet.size === 0) {
      return;
    }

    let startComparison = rootComparison;
    start_on_max_depth: {
      const [firstComparisonCausingDiff] = causeSet;
      if (
        firstComparisonCausingDiff.depth >= maxDepth &&
        !rootComparison.category
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
    }

    const actualValueMeta = {
      resultType: "actualNode",
      name: "actual",
      shortname: "actual",
      color: unexpectedColor,
    };
    const expectedValueMeta = {
      resultType: "expectedNode",
      name: "expected",
      shortname: "expect",
      color: expectedColor,
    };
    const firstValueMeta = actualIsFirst ? actualValueMeta : expectedValueMeta;
    const secondValueMeta = actualIsFirst ? expectedValueMeta : actualValueMeta;

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
      onComparisonDisplayed,
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

    let firstPrefix = "";
    let firstValueDiff;
    actual_diff: {
      firstPrefix += ANSI.color(firstValueMeta.shortname, sameColor);
      firstPrefix += ANSI.color(":", sameColor);
      firstPrefix += " ";
      firstValueDiff = writeDiff(startComparison, {
        ...contextBase,
        resultType: firstValueMeta.resultType,
        textIndent: stringWidth(firstPrefix),
      });
    }
    let secondPrefix = "";
    let secondValueDiff;
    expected_diff: {
      secondPrefix += ANSI.color(secondValueMeta.shortname, sameColor);
      secondPrefix += ANSI.color(":", sameColor);
      secondPrefix += " ";
      secondValueDiff = writeDiff(startComparison, {
        ...contextBase,
        resultType: secondValueMeta.resultType,
        textIndent: stringWidth(secondPrefix),
      });
    }

    let diffMessage = "";
    diffMessage += firstPrefix;
    diffMessage += firstValueDiff;
    diffMessage += "\n";
    diffMessage += secondPrefix;
    diffMessage += secondValueDiff;

    let message;
    if (rootComparison.category) {
      message = `${ANSI.color(firstValueMeta.name, firstValueMeta.color)} and ${ANSI.color(secondValueMeta.name, secondValueMeta.color)} are different`;
    } else {
      message = `${ANSI.color(firstValueMeta.name, firstValueMeta.color)} and ${ANSI.color(secondValueMeta.name, secondValueMeta.color)} have ${causeCounters.total} ${causeCounters.total === 1 ? "difference" : "differences"}`;
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

const shouldIgnoreComparison = (comparison) => {
  const { actualNode, expectedNode } = comparison;

  if (comparison.type === "property_descriptor") {
    if (!actualNode) {
      // show only if not the default
      return isDefaultDescriptor(expectedNode.descriptor, expectedNode.value);
    }
    if (!expectedNode) {
      // show only if not the default
      return isDefaultDescriptor(actualNode.descriptor, actualNode.value);
    }
    // if no diff and both are default, hide
    if (
      comparison.counters.overall.any === 0 &&
      isDefaultDescriptor(actualNode.descriptor, actualNode.value) &&
      isDefaultDescriptor(expectedNode.descriptor, expectedNode.value)
    ) {
      return true;
    }
    return false;
  }
  if (comparison.type === "value_of_return_value") {
    if (!actualNode) {
      // show only if it's a custom valueOf with a custom behaviour
      // (something else than returning composite itself)
      return expectedNode.value === expectedNode.parent.value;
    }
    if (!expectedNode) {
      // show only if it's a custom valueOf with a custom behaviour
      // (something else than returning composite itself)
      return actualNode.value === actualNode.parent.value;
    }
    if (comparison.counters.overall.any === 0) {
      return true;
    }
    // actual parent or expected parent is a composite
    // and the other is a primitive
    // but when they hold the same value in the end
    const parentComparison = comparison.actualNode.parent.comparison;
    const actualInternalOrSelfNode = parentComparison.actualNode.isComposite
      ? actualNode
      : parentComparison.actualNode;
    const expectedInternalOrSelfNode = parentComparison.actualNode.isComposite
      ? expectedNode
      : parentComparison.expectedNode;
    if (
      actualInternalOrSelfNode.subtype === expectedInternalOrSelfNode.subtype
    ) {
      return true;
    }
    // value of differ but prototype is different so it's expected
    const prototypeComparison = parentComparison.prototypeComparison;
    if (prototypeComparison.counters.overall.any > 0) {
      return true;
    }
    return false;
  }
  if (comparison.type === "prototype") {
    if (!actualNode || !expectedNode) {
      return true;
    }
    if (comparison.counters.overall.any === 0) {
      return true;
    }
    // when we see a prefix like
    // actual: User {}
    // expect: Animal {}
    // we don't show the prototype
    if (actualNode.subtype !== expectedNode.subtype) {
      return true;
    }
    // but when both have the same prefix AND a prototype diff
    // then we display it
    return false;
  }
  if (comparison.type === "line") {
    return true;
  }
  if (comparison.type === "char") {
    return true;
  }
  return false;
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

let createValueNode;
{
  let nodeId = 1;
  createValueNode = ({ name, value, getReference }) => {
    const _createValueNode = ({ parent, path, type, value, origin }) => {
      const node = {
        id: nodeId++,
        path,
      };

      info: {
        let composite = false;
        let wellKnownId;
        let subtype;
        let isArray = false;
        let isSet = false;
        let isString = false;
        let isStringObject = false;
        let isUrl = false;
        let isUrlString = false;
        let reference = null;
        if (value === ARRAY_EMPTY_VALUE) {
          wellKnownId = "empty";
          subtype = "empty";
        } else if (type === "property") {
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
            subtype = getSubtype(value);
            reference = getReference(value, node);
            visitPrototypes(value, (proto) => {
              if (proto.constructor) {
                if (proto.constructor.name === "Array") {
                  isArray = true;
                } else if (proto.constructor.name === "Set") {
                  isSet = true;
                } else if (proto.constructor.name === "String") {
                  isStringObject = true;
                } else if (proto.constructor.name === "URL") {
                  isUrl = true;
                }
              }
            });
          } else if (value === null) {
            subtype = "null";
          } else {
            subtype = typeof value;
            if (subtype === "string") {
              isString = true;
              isUrlString = canParseUrl(value);
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
          } else if (type === "as_string" && inConstructor) {
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
          parent,
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
          reference,
          referenceFromOthersSet: new Set(),

          keys: null,
          chars: null,
        });
      }

      node.structureIsKnown = Boolean(node.wellKnownId || node.reference);

      // prototype
      if (node.isComposite && !node.structureIsKnown) {
        const prototypeNode = _createValueNode({
          parent: node,
          path: path.append("__proto__"),
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
          path: path.append("valueOf()"),
          type: "value_of_return_value",
          value: node.value.valueOf(),
        });
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
          path: path.append("__string__"),
          type: "as_string",
          value: String(node.value),
        });
        node.asStringNode = asStringNode;
      }

      // properties
      if (node.isComposite && !node.structureIsKnown) {
        const propertyNodes = {};
        const keys = [];

        const shouldIgnoreProperty = (propertyName) => {
          if (node.isArray) {
            if (propertyName === "length") {
              return true;
            }
            if (isArrayIndex(propertyName)) {
              return true;
            }
          }
          if (node.isComposite && node.subtype === "String") {
            if (propertyName === "length") {
              return true;
            }
            if (isArrayIndex(propertyName)) {
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
          if (node.valueOfReturnValue && propertyName === "valueOf") {
            return true;
          }
          return false;
        };
        const propertyNames = Object.getOwnPropertyNames(node.value);
        for (const propertyName of propertyNames) {
          if (shouldIgnoreProperty(propertyName)) {
            continue;
          }
          keys.push(propertyName);

          const propertyDescriptor = Object.getOwnPropertyDescriptor(
            node.value,
            propertyName,
          );
          const propertyNode = _createValueNode({
            parent: node,
            path: path.append(propertyName),
            type: "property",
            value: propertyDescriptor,
          });
          propertyNode.property = propertyName;
          const descriptorNodes = {
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
              path: path.append(propertyDescriptorName),
              type: "property_descriptor",
              value: propertyDescriptorValue,
            });
            propertyDescriptorNode.property = propertyName;
            propertyDescriptorNode.descriptor = propertyDescriptorName;
            descriptorNodes[propertyDescriptorName] = propertyDescriptorNode;
          }
          propertyNode.descriptorNodes = descriptorNodes;
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
            parent: node,
            path: path.append(indexedValue),
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
        const lineNodes = [];

        const lines = node.value.split(/\r?\n/);
        for (const line of lines) {
          const lineNode = _createValueNode({
            parent: node,
            path,
            type: "line",
            value: line,
          });
          const lineNodeIndex = lineNodes.length;
          lineNodes[lineNodeIndex] = lineNode;
        }

        node.lineNodes = lineNodes;
      }
      if (node.canHaveChars && !node.structureIsKnown) {
        const charNodes = [];

        const chars = splitChars(node.value);
        for (const char of chars) {
          const charNode = _createValueNode({
            parent: node,
            path,
            type: "char",
            value: char,
          });
          const charNodeIndex = charNodes.length;
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
            parent: node,
            path,
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
      path: createValuePath(),
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
  writeDiff = (comparison, context) => {
    if (shouldIgnoreComparison(comparison)) {
      return "";
    }
    context.onComparisonDisplayed(comparison);
    const node = comparison[context.resultType];
    const valueContext = { ...context };

    if (context.modified) {
      // modified takes precedence
    } else if (comparison.modified) {
      valueContext.modified = true;
    } else if (comparison.added) {
      valueContext.added = true;
    } else if (comparison.removed) {
      valueContext.removed = true;
    }

    let diff = "";
    let displayValue = true;
    let endSeparator;
    const delimitersColor = getDelimitersColor(valueContext);
    const isNestedValue =
      node.type === "indexed_value" ||
      node.type === "property_descriptor" ||
      node.type === "prototype" ||
      node.type === "value_of_return_value" ||
      node.type === "as_string";

    if (isNestedValue) {
      const relativeDepth = node.depth + valueContext.initialDepth;
      let useIndent;
      if (context.collapsed) {
        useIndent = false;
      } else {
        useIndent = true;
        if (relativeDepth >= valueContext.maxDepth) {
          valueContext.collapsed = true;
          valueContext.insideOverview = true;
        } else if (comparison.counters.overall.any === 0) {
          valueContext.collapsed = true;
          valueContext.insideOverview = true;
        }
      }

      if (useIndent) {
        let indent = `  `.repeat(relativeDepth);
        if (valueContext.signs) {
          if (comparison.removed) {
            if (valueContext.resultType === "expectedNode") {
              diff += ANSI.color(removedSign, removedSignColor);
              indent = indent.slice(1);
            }
          } else if (comparison.added) {
            if (valueContext.resultType === "actualNode") {
              diff += ANSI.color(addedSign, addedSignColor);
              indent = indent.slice(1);
            }
          } else if (comparison.modified) {
            if (valueContext.resultType === "actualNode") {
              diff += ANSI.color(unexpectedSign, unexpectedSignColor);
              indent = indent.slice(1);
            }
          }
        }
        diff += indent;
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
      if (property && comparison !== valueContext.startComparison) {
        let keyColor;
        if (context.added) {
          keyColor = addedColor;
        } else if (context.removed) {
          keyColor = removedColor;
        } else if (context.modified) {
          keyColor =
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
        } else {
          keyColor = sameColor;
        }

        if (
          node.type === "property_descriptor" &&
          node.descriptor !== "value"
        ) {
          diff += ANSI.color(node.descriptor, keyColor);
          diff += " ";
        }
        const propertyKeyFormatted = humanizePropertyKey(property);
        diff += ANSI.color(propertyKeyFormatted, keyColor);
        if (displayValue) {
          diff += ANSI.color(":", keyColor);
          diff += " ";
        }
      }
      if (node.canHaveLines && node.lineNodes.length > 1) {
        // when using
        // foo: 1| line 1
        //      2| line 2
        //      3| line 3
        // the "," separator is removed because it's not correctly separated from the multiline
        // and it becomes hard to know if "," is part of the string or not
        endSeparator = "";
      } else if (useIndent && comparison !== valueContext.startComparison) {
        endSeparator = ",";
      } else {
        endSeparator = "";
      }
      if (displayValue) {
        valueContext.textIndent += stringWidth(diff);
        valueContext.maxColumns -= endSeparator.length;
        if (valueContext.modified) {
          valueContext.maxDepth = Math.min(
            node.depth + valueContext.maxDepthInsideDiff,
            valueContext.maxDepth,
          );
        }
      }
    }

    value: {
      if (!displayValue) {
        break value;
      }

      if (context.collapsed) {
        if (node.type === "property") {
          const propertyDescriptorComparisons =
            comparison.propertyDescriptorComparisons;
          const propertyGetterComparison = propertyDescriptorComparisons.get;
          const propertySetterComparison = propertyDescriptorComparisons.set;
          const propertyGetterNode = propertyGetterComparison
            ? propertyGetterComparison[valueContext.resultType]
            : null;
          const propertySetterNode = propertySetterComparison
            ? propertySetterComparison[valueContext.resultType]
            : null;
          if (propertyGetterNode && propertySetterNode) {
            diff += writeDiff(propertyGetterComparison, valueContext);
            break value;
          }
          if (propertyGetterNode) {
            diff += writeDiff(propertyGetterComparison, valueContext);
            break value;
          }
          if (propertySetterNode) {
            diff += writeDiff(propertySetterComparison, valueContext);
            break value;
          }
          const propertyValueComparison = propertyDescriptorComparisons.value;
          diff += writeDiff(propertyValueComparison, valueContext);
          break value;
        }
        if (node.type === "property_descriptor") {
          if (node.descriptor === "get") {
            const valueColor = getValueColor(valueContext);
            const setterNode = node.parent.descriptorNodes.set;
            if (setterNode && setterNode.value) {
              diff += ANSI.color("[get/set]", valueColor);
              break value;
            }
            diff += ANSI.color("[get]", valueColor);
            break value;
          }
          if (node.descriptor === "set") {
            const valueColor = getValueColor(valueContext);
            const getterNode = node.parent.descriptorNodes.get;
            if (getterNode && getterNode.value) {
              diff += ANSI.color("[get/set]", valueColor);
            } else {
              diff += ANSI.color("[set]", valueColor);
            }
            break value;
          }
        }
      }
      if (node.type === "property") {
        const propertyDescriptorComparisons =
          comparison.propertyDescriptorComparisons;
        let propertyDiff = "";
        const propertyDescriptorNames = Object.keys(
          propertyDescriptorComparisons,
        );
        for (const propertyDescriptorName of propertyDescriptorNames) {
          const propertyDescriptorComparison =
            propertyDescriptorComparisons[propertyDescriptorName];
          if (propertyDescriptorComparison) {
            propertyDiff += writeDiff(
              propertyDescriptorComparison,
              valueContext,
            );
          }
        }
        diff += propertyDiff;
        break value;
      }
      if (node.wellKnownId) {
        const valueColor = getValueColor(valueContext);
        diff += ANSI.color(node.wellKnownId, valueColor);
        break value;
      }
      if (node.isUrlString) {
        diff += writeCompositeDiff(comparison, valueContext);
        break value;
      }
      if (node.isPrimitive) {
        if (comparison.asStringComparison && node.type === "as_string") {
          diff += writeLinesDiff(comparison.asStringComparison, valueContext);
          break value;
        }
        if (node.canHaveLines) {
          diff += writeLinesDiff(comparison, valueContext);
          break value;
        }
        if (node.isString) {
          diff += writeCharDiff(comparison, valueContext);
          break value;
        }

        const value = node.value;
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
        diff += ANSI.color(valueDiff, valueColor);
        break value;
      }
      diff += writeCompositeDiff(comparison, valueContext);
      break value;
    }

    if (endSeparator) {
      diff += ANSI.color(endSeparator, delimitersColor);
    }
    return diff;
  };

  const writeOneLineDiff = (lineComparison, context) => {
    let { focusedCharIndex } = context;

    const charComparisons = lineComparison.charComparisons;
    const lineNode = lineComparison[context.resultType];
    const charNodes = lineNode.charNodes;
    const charBeforeArray = [];
    const charAfterArray = [];

    let remainingWidth = context.maxColumns - context.textIndent;
    const focusedCharComparison = charComparisons[focusedCharIndex];
    let focusedCharDiff;
    if (focusedCharComparison) {
      focusedCharDiff = writeDiff(focusedCharComparison, { ...context });
      remainingWidth -= stringWidth(focusedCharDiff);
    } else {
      focusedCharDiff = "";
      focusedCharIndex = charNodes.length - 1;
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
      const hasNextChar = nextCharIndex < charNodes.length;
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
      const charDiff = writeDiff(charNode.comparison, { ...context });
      const charWidth = stringWidth(charDiff);
      let nextWidth = charWidth;
      if (charIndex - 1 > 0) {
        nextWidth += leftOverflowBoilerplateWidth;
      }
      if (charIndex + 1 < charNodes.length - 1) {
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
    const overflowRight =
      focusedCharIndex + nextCharAttempt < charNodes.length - 1;
    if (overflowLeft) {
      oneLineDiff += ANSI.color("…", delimitersColor);
    }
    const stringNode = lineNode.parent;
    const stringComparison = stringNode.comparison;
    const bracketColor = getBracketColor(context, stringComparison);
    if (stringComparison.quote) {
      oneLineDiff += ANSI.color(stringComparison.quote, bracketColor);
    }
    oneLineDiff += charBeforeArray.reverse().join("");
    oneLineDiff += focusedCharDiff;
    oneLineDiff += charAfterArray.join("");
    if (stringComparison.quote) {
      oneLineDiff += ANSI.color(stringComparison.quote, bracketColor);
    }
    if (overflowRight) {
      oneLineDiff += ANSI.color("…", delimitersColor);
    }
    return oneLineDiff;
  };
  const writeLinesDiff = (comparison, context) => {
    const node = comparison[context.resultType];

    const lineNodes = node.lineNodes;
    const lineComparisons = comparison.lineComparisons;
    empty_string: {
      const firstLineNode = lineNodes[0];
      if (firstLineNode.value === "") {
        const quote = node.quote || DOUBLE_QUOTE;
        const bracketColor = getBracketColor(context, comparison);
        let expandedDiff = "";
        expandedDiff += ANSI.color(quote, bracketColor);
        expandedDiff += ANSI.color(quote, bracketColor);
        return expandedDiff;
      }
    }

    // collapsed
    if (context.collapsed) {
      if (!comparison.quote && node.type !== "url_part") {
        const quote =
          context.quote === "auto" ? pickBestQuote(node.value) : context.quote;
        comparison.quote = quote; // ensure the quote in expected is "forced" to the one in actual
      }

      const remainingWidth = context.maxColumns - context.textIndent;
      let maxWidth = Math.min(remainingWidth, 20);
      if (comparison.quote) {
        const quoteWidth = comparison.quote.length;
        maxWidth -= quoteWidth + quoteWidth;
      }
      let stringDiff;
      const width = stringWidth(node.value);
      if (width > maxWidth) {
        stringDiff = node.value.slice(0, maxWidth - "…".length);
        stringDiff += "…";
      } else {
        stringDiff = node.value;
      }
      const valueColor = getValueColor(context);
      let stringOverviewDiff = "";
      if (comparison.quote) {
        let quoteColor;
        let comparisonForQuotes = comparison;
        if (comparison.type === "as_string") {
          comparisonForQuotes = comparison.parent;
        }
        if (comparison.removed) {
          quoteColor = removedColor;
        } else if (comparison.added) {
          quoteColor = addedColor;
        } else if (comparison.modified) {
          quoteColor =
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
        } else if (
          comparisonForQuotes.actualNode.isComposite ===
          comparisonForQuotes.expectedNode.isComposite
        ) {
          quoteColor = sameColor;
        } else {
          quoteColor =
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
        }
        stringOverviewDiff += ANSI.color(comparison.quote, quoteColor);
        stringOverviewDiff += ANSI.color(stringDiff, valueColor);
        stringOverviewDiff += ANSI.color(comparison.quote, quoteColor);
      } else {
        stringOverviewDiff += ANSI.color(stringDiff, valueColor);
      }
      return stringOverviewDiff;
    }

    single_line: {
      const isSingleLine = lineNodes.length === 1;
      // single line string (both actual and expected)
      if (!isSingleLine) {
        break single_line;
      }
      if (!comparison.quote && node.type !== "url_part") {
        const quote =
          context.quote === "auto" ? pickBestQuote(node.value) : context.quote;
        comparison.quote = quote; // ensure the quote in expected is "forced" to the one in actual
      }
      const firstLineComparison = lineComparisons[0];
      const focusedCharIndex = getFocusedCharIndex(firstLineComparison);
      const firstLineContext = {
        ...context,
        focusedCharIndex,
      };
      return writeOneLineDiff(firstLineComparison, firstLineContext);
    }

    multiline: {
      let focusedLineIndex = lineComparisons.findIndex((lineComparison) => {
        return lineComparison.counters.overall.any > 0;
      });
      if (focusedLineIndex === -1) {
        focusedLineIndex = lineNodes.length - 1;
      }
      const focusedLineComparison = lineComparisons[focusedLineIndex];
      const focusedCharIndex = getFocusedCharIndex(focusedLineComparison);
      let biggestLineNumber = focusedLineIndex + 1;

      const lineBeforeArray = [];
      let maxLineBefore = context.maxLineBeforeDiff - 1;
      while (maxLineBefore--) {
        const previousLineIndex = focusedLineIndex - lineBeforeArray.length - 1;
        const hasPreviousLine = previousLineIndex >= 0;
        if (!hasPreviousLine) {
          break;
        }
        const previousLineComparison = lineComparisons[previousLineIndex];
        lineBeforeArray.push(previousLineComparison);
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
        const nextLineComparison = lineComparisons[nextLineIndex];
        lineAfterArray.push(nextLineComparison);
        if (nextLineIndex + 1 > biggestLineNumber) {
          biggestLineNumber = nextLineIndex + 1;
        }
      }
      let nextLineRemaining =
        lineNodes.length - 1 - focusedLineIndex - lineAfterArray.length;
      if (nextLineRemaining === 1) {
        lineAfterArray.push(lineComparisons[lineComparisons.length - 1]);
        nextLineRemaining = 0;
      }

      const writeLineDiff = (lineComparison) => {
        const lineContext = {
          ...context,
          focusedCharIndex,
        };
        const delimitersColor = getDelimitersColor(lineContext);

        let lineDiff = "";
        const lineNumberString = String(lineComparison.index + 1);
        if (String(biggestLineNumber).length > lineNumberString.length) {
          lineDiff += " ";
        }
        lineDiff += ANSI.color(lineNumberString, delimitersColor);
        // lineDiff += " ";
        lineDiff += ANSI.color("|", delimitersColor);
        lineDiff += " ";

        lineDiff += writeOneLineDiff(lineComparison, lineContext);
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
      for (const lineBefore of lineBeforeArray) {
        diffLines.push(writeLineDiff(lineBefore));
      }
      diffLines.push(writeLineDiff(focusedLineComparison));
      for (const lineAfter of lineAfterArray) {
        diffLines.push(writeLineDiff(lineAfter));
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
          const nextLineComparison = lineComparisons[index];
          index++;
          skippedCounters.total++;
          if (nextLineComparison.counters.overall.any > 0) {
            context.onComparisonDisplayed(nextLineComparison);
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
        if (
          comparison.actualNode.lineNodes.length ===
          comparison.expectedNode.lineNodes.length
        ) {
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
  const writeCharDiff = (comparison, context) => {
    const node = comparison[context.resultType];
    const valueColor = getValueColor(context);
    const { preserveLineBreaks } = context;
    const { quote } = comparison;
    const char = node[context.resultType].value;
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
  const writeCompositeDiff = (comparison, context) => {
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
        const referenceFromOtherComparison = referenceFromOther.comparison;
        if (
          referenceFromOtherComparison &&
          shouldIgnoreComparison(referenceFromOtherComparison)
        ) {
          continue;
        }
        referenceFromOtherDisplayed = referenceFromOther;
        break;
      }
      if (referenceFromOtherDisplayed) {
        compositeDiff += ANSI.color(
          `<ref #${context.getDisplayedId(
            referenceFromOtherDisplayed.reference.id,
          )}>`,
          delimitersColor,
        );
        compositeDiff += " ";
      }
    }
    inside: {
      if (context.collapsed) {
        if (context.insideOverview) {
          const overviewDiff = writeOverviewDiff(comparison, context);
          compositeDiff += overviewDiff;
        } else {
          const collapsedDiff = writeCollapsedDiff(comparison, context);
          compositeDiff += collapsedDiff;
        }
      } else {
        const expandedDiff = writeExpandedDiff(comparison, context);
        compositeDiff += expandedDiff;
      }
    }
    return compositeDiff;
  };
  const writePrefix = (
    comparison,
    context,

    { overview } = {},
  ) => {
    const node = comparison[context.resultType];
    let prefix = "";

    const displayValueOfInsideConstructor =
      node.isComposite &&
      // value returned by valueOf() is not the composite itself
      node.valueOfReturnValueNode &&
      node.valueOfReturnValueNode.inConstructor &&
      !shouldIgnoreComparison(comparison, context);
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
      if (comparison.added) {
        subtypeColor = addedColor;
      } else if (comparison.removed) {
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
      let lengthColor = comparison.added
        ? addedColor
        : comparison.removed
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
      let lengthColor = comparison.added
        ? addedColor
        : comparison.removed
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
        insideConstructor = writeDiff(
          comparison.valueOfReturnValueComparison,
          context,
        );
        // if (overview) {
        //   insideConstructor = writeDiff(node.valueOfReturnValue, context);
        // } else {
        //   insideConstructor = writeValueDiff(node.valueOfReturnValue, context);
        // }
      } else if (overview) {
        let overviewContent = node.isSet
          ? node.indexedValueNodes.length
          : node.keys.length;
        if (comparison.added) {
          insideConstructor = ANSI.color(overviewContent, addedColor);
        } else if (comparison.removed) {
          insideConstructor = ANSI.color(overviewContent, removedColor);
        } else if (
          comparison.actualNode.isSet &&
          comparison.expectedNode.isSet
        ) {
          if (context.resultType === "actualNode") {
            const added = !comparison.expectedNode.value.has(node.value);
            insideConstructor = ANSI.color(
              overviewContent,
              added ? addedColor : sameColor,
            );
          } else {
            const removed = !comparison.expectedNode.value.has(node.value);
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
  const writeUrlDiff = (comparison, context) => {
    const urlPartComparisons = comparison.urlPartComparisons;

    const writeUrlPart = (urlPartName) => {
      const urlPartComparison = urlPartComparisons[urlPartName];
      if (String(urlPartComparison[context.resultType]) === "") {
        return "";
      }
      const urlPartDiff = writeDiff(urlPartComparison, context);
      return urlPartDiff;
    };

    let urlDiff = "";
    const bracketColor = getBracketColor(context, comparison);
    urlDiff += ANSI.color(`"`, bracketColor);
    urlDiff += writeUrlPart("protocol");
    const usernameDiff = writeUrlPart("username");
    if (usernameDiff) {
      urlDiff += usernameDiff;
    }
    const passwordDiff = writeUrlPart("password");
    if (passwordDiff) {
      const passwordComparison = urlPartComparisons.password;
      const actualHasPassword = passwordComparison.actualNode.value.length;
      const expectedHasPassword = passwordComparison.expectedNode.value.length;
      let passwordSeparatorColor;
      if (actualHasPassword && !expectedHasPassword) {
        passwordSeparatorColor = addedColor;
      } else if (!actualHasPassword && expectedHasPassword) {
        passwordSeparatorColor = removedColor;
      } else if (passwordComparison.counters.overall.any) {
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
        const usernameComparison = urlPartComparisons.username;
        const passwordComparison = urlPartComparisons.password;
        const actualHasAuth =
          usernameComparison.actualNode.value.length ||
          passwordComparison.actualNode.value.length;
        const expectedHasAuth =
          usernameComparison.expectedNode.value.length ||
          passwordComparison.expectedNode.value.length;
        let authSeparatorColor;
        if (actualHasAuth && !expectedHasAuth) {
          authSeparatorColor = addedColor;
        } else if (!actualHasAuth && expectedHasAuth) {
          authSeparatorColor = removedColor;
        } else if (
          passwordComparison[context.resultType].length
            ? passwordComparison.counters.overall.any
            : usernameComparison.counters.overall.any
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
        const portComparison = urlPartComparisons.port;
        const actualHasPort =
          String(portComparison.actualNode.value).length > 0;
        const expectedHasPort =
          String(portComparison.expectedNode.value).length > 0;
        let portSeparatorColor;
        if (actualHasPort && !expectedHasPort) {
          portSeparatorColor = addedColor;
        } else if (!actualHasPort && expectedHasPort) {
          portSeparatorColor = removedColor;
        } else if (portComparison.counters.overall.any) {
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
      const searchComparison = urlPartComparisons.search;
      const actualHasSearch = searchComparison.actualNode.value.length;
      const expectedHasSearch = searchComparison.expectedNode.value.length;
      let searchSeparatorColor;
      if (actualHasSearch && !expectedHasSearch) {
        searchSeparatorColor = addedColor;
      } else if (!actualHasSearch && expectedHasSearch) {
        searchSeparatorColor = removedColor;
      } else if (searchComparison.counters.overall.any) {
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
      const hashComparison = urlPartComparisons.hash;
      const actualHasHash = hashComparison.actualNode.value.length;
      const expectedHasHash = hashComparison.expectedNode.value.length;
      let hashSeparatorColor;
      if (actualHasHash && !expectedHasHash) {
        hashSeparatorColor = addedColor;
      } else if (!actualHasHash && expectedHasHash) {
        hashSeparatorColor = removedColor;
      } else if (hashComparison.counters.overall.any) {
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
  const writeExpandedDiff = (comparison, context) => {
    const node = comparison[context.resultType];
    if (node.isString && !node.isUrlString && node.canHaveLines) {
      return writeLinesDiff(node, context);
    }
    if (node.type === "as_string") {
      return writeLinesDiff(node, context);
    }

    const delimitersColor = getDelimitersColor(context);
    const relativeDepth = node.depth + context.initialDepth;
    let indent = "  ".repeat(relativeDepth);
    let diffCount = 0;

    const appendNestedValueDiff = (nestedComparison) => {
      let diff = writeDiff(nestedComparison, {
        ...context,
        textIndent: 0,
      });
      if (nestedComparison !== context.startComparison) {
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
      let nestedComparison;
      while ((nestedComparison = next())) {
        if (nestedComparison.counters.overall.any === 0) {
          entryBeforeDiffArray.push(nestedComparison);
          continue;
        }
        diffCount++;
        // too many diff
        if (diffCount > context.maxDiffPerObject) {
          skippedArray.push(nestedComparison);
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
            beforeDiff += appendNestedValueDiff(entryBeforeDiff);
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
        groupDiff += appendNestedValueDiff(nestedComparison);
      }

      skippedArray.push(...entryBeforeDiffArray);
      // now display the values after
      const skippedCount = skippedArray.length;
      if (skippedCount) {
        const maxValueAfter = Math.min(
          comparison.modified
            ? context.maxValueInsideDiff - 1
            : context.maxValueAfterDiff - 1,
          skippedArray.length,
        );
        let from = 0;
        let to = maxValueAfter;
        let index = from;
        while (index !== to) {
          const nextComparison = skippedArray[index];
          if (nextComparison.counters.self.any > 0) {
            break;
          }
          index++;
          groupDiff += appendNestedValueDiff(nextComparison);
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
        for (const skippedComparison of skippedArray) {
          skippedCounters.total++;
          if (context.resultType === "actualNode") {
            if (skippedComparison.added) {
              context.onComparisonDisplayed(skippedComparison);
              skippedCounters.added++;
              continue;
            }
            if (skippedComparison.counters.overall.any > 0) {
              context.onComparisonDisplayed(skippedComparison);
              skippedCounters.modified++;
              continue;
            }
            continue;
          }
          if (skippedComparison.removed) {
            context.onComparisonDisplayed(skippedComparison);
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
          if (comparison.added) {
            groupDiff += ANSI.color(addedSign, addedSignColor);
            indent = indent.slice(1);
          } else if (comparison.modified) {
            groupDiff += ANSI.color(unexpectedSign, unexpectedSignColor);
            indent = indent.slice(1);
          }
        } else if (comparison.removed) {
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
        const bracketColor = getBracketColor(context, comparison);
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
      prefix = writePrefix(comparison, context);
      insideDiff += prefix;
    }

    if (node.isUrl || node.isUrlString) {
      let urlDiff;
      if (node.canDiffUrlParts) {
        urlDiff = writeUrlDiff(comparison, context);
      } else {
        urlDiff = writeDiff(comparison.asStringComparison, context);
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
        createGetIndexedValues(comparison, context),
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
      const propsDiff = writeGroupDiff(createGetProps(comparison, context), {
        valueLabel: "prop",
        forceBracket: !node.canHaveIndexedValues && prefix.length === 0,
        openBracket: "{",
        closeBracket: "}",
      });
      if (propsDiff) {
        if (insideDiff) {
          insideDiff += " ";
        }
        insideDiff += propsDiff;
      }
    }
    return insideDiff;
  };
  const writeOverviewDiff = (comparison, context) => {
    const node = comparison[context.resultType];
    const prefixWithOverview = writePrefix(comparison, context, {
      overview: true,
    });
    const delimitersColor = getDelimitersColor(context);
    const bracketColor = getBracketColor(context, comparison);
    const valueColor = getValueColor(context);
    const {
      openBracket,
      closeBracket,
      nestedValueSeparator,
      nestedValueSpacing,
      ellipsis,
    } = getDelimiters(comparison, context);

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
    let nestedComparison;
    const next = createGetNextNestedValue(comparison, context);
    while ((nestedComparison = next())) {
      let valueOverview = "";
      valueOverview += writeDiff(nestedComparison, context);
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
    const prefix = writePrefix(node, context);
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
  const writeCollapsedDiff = (comparison, context) => {
    return writePrefix(comparison, context, {
      overview: true,
    });
  };
  const createGetNextNestedValue = (comparison, context) => {
    const nextIndexedValue = createGetIndexedValues(comparison, context);
    const nextProp = createGetProps(comparison, context);
    return () => {
      const indexedValue = nextIndexedValue();
      if (indexedValue) {
        return indexedValue;
      }
      return nextProp();
    };
  };
  const createGetIndexedValues = (comparison, context) => {
    const node = comparison[context.resultType];
    const indexedValueNodes = node.indexedValueNodes || [];
    const indexedValueCount = indexedValueNodes.length;
    let indexedValueIndex = 0;
    return () => {
      if (indexedValueIndex < indexedValueCount) {
        const indexedValueNode = indexedValueNodes[indexedValueIndex];
        indexedValueIndex++;
        return indexedValueNode;
      }
      return null;
    };
  };
  const createGetProps = (comparison, context) => {
    const node = comparison[context.resultType];
    const propertyNodes = node.propertyNodes || {};
    const propertyNames = Object.keys(propertyNodes);
    const propertyCount = propertyNames.length;
    let valueOfReturnValueComparisonToDisplay =
      comparison.valueOfReturnValueComparison;
    let prototypeComparisonToDisplay = comparison.prototypeComparison;
    let propIndex = 0;

    return () => {
      if (valueOfReturnValueComparisonToDisplay) {
        if (
          !valueOfReturnValueComparisonToDisplay[context.resultType]
            .inConstructor
        ) {
          valueOfReturnValueComparisonToDisplay = null;
        } else if (
          shouldIgnoreComparison(valueOfReturnValueComparisonToDisplay, context)
        ) {
          valueOfReturnValueComparisonToDisplay = null;
        } else {
          let nestedComparison = valueOfReturnValueComparisonToDisplay;
          valueOfReturnValueComparisonToDisplay = null;
          return nestedComparison;
        }
      }
      if (prototypeComparisonToDisplay) {
        if (shouldIgnoreComparison(prototypeComparisonToDisplay, context)) {
          prototypeComparisonToDisplay = null;
        } else {
          let nestedComparison = prototypeComparisonToDisplay;
          prototypeComparisonToDisplay = null;
          return nestedComparison;
        }
      }
      if (propIndex < propertyCount) {
        const propertyName = propertyNames[propIndex];
        propIndex++;
        const propertyComparison = comparison.propertyComparisons[propertyName];
        return propertyComparison;
      }
      return null;
    };
  };

  const getDelimiters = (comparison, context) => {
    const node = comparison[context.resultType];
    if (node.isArray) {
      return {
        openBracket: "[",
        closeBracket: "]",
        nestedValueSeparator: ",",
        ellipsis: "...",
      };
    }
    if (node.isComposite) {
      return {
        openBracket: "{",
        closeBracket: "}",
        nestedValueSeparator: ",",
        nestedValueSpacing: true,
        ellipsis: "...",
      };
    }
    if (node.canHaveLines) {
      return {
        openBracket: `${node.index + 1} | `,
        closeBracket: "",
      };
    }
    if (node.canHaveChars) {
      return {
        nestedValueSeparator: "",
        ellipsis: "...",
      };
    }
    return null;
  };
  const getDelimitersColor = (context) => {
    if (context.removed) {
      return removedColor;
    }
    if (context.added) {
      return addedColor;
    }
    if (context.modified) {
      return context.resultType === "actualNode"
        ? unexpectedColor
        : expectedColor;
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
      return context.resultType === "actualNode"
        ? unexpectedColor
        : expectedColor;
    }
    return sameColor;
  };
  const getBracketColor = (context, comparison) => {
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

const getFocusedCharIndex = (
  comparison,
  // context
) => {
  const charWithDiffIndex = comparison.charComparisons.findIndex(
    (charComparison) => {
      return charComparison.counters.overall.any > 0;
    },
  );
  if (charWithDiffIndex !== -1) {
    return charWithDiffIndex;
  }
  return -1;
  // const charNodes = comparison[context.resultType].charNodes;
  // return charNodes.length - 1;
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
