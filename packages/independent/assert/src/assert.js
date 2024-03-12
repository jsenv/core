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
    const comparisonTree = createComparisonTree(actual, expected);
    const rootComparison = comparisonTree.root;
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
      if (node.type === "value_of_return_value") {
        if (node.actual.redundant && node.expected.redundant) {
          // diff expected, one is primitive, other is composite for example
          return true;
        }
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

    const visit = (
      node,
      {
        // ignoreDiff is meant to ignore the diff between actual/expected
        // (usually because comparison cannot be made (added,removed, visiting something different))
        // but the structure still have to be visited (properties, values, valueOf, ...)
        ignoreDiff,
      } = {},
    ) => {
      const doVisit = () => {
        if (node.type === "property") {
          const visitPropertyDescriptor = (descriptorName) => {
            const actualDescriptor = node.actual.value;
            const actualDescriptorValue = actualDescriptor
              ? actualDescriptor[descriptorName]
              : undefined;
            const expectedDescriptor = node.expected.value;
            const expectedDescriptorValue = expectedDescriptor
              ? expectedDescriptor[descriptorName]
              : undefined;
            const descriptorNode = node.appendPropertyDescriptor(
              descriptorName,
              {
                actualValue: actualDescriptorValue,
                expectedValue: expectedDescriptorValue,
              },
            );
            visit(descriptorNode, { ignoreDiff });
            if (ignoreDiff) {
              return;
            }
            node.diff[descriptorNode.descriptor] = descriptorNode.diff;
            appendCounters(
              node.diff.counters.self,
              descriptorNode.diff.counters.self,
            );
            appendCounters(
              node.diff.counters.inside,
              descriptorNode.diff.counters.inside,
            );
            appendCounters(
              node.diff.counters.overall,
              descriptorNode.diff.counters.overall,
            );
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
          addNodeCausingDiff(node);
          node.diff.counters.self.modified++;
        };
        reference: {
          if (ignoreDiff) {
            break reference;
          }
          if (node.actual.reference !== node.expected.reference) {
            node.diff.reference = true;
            onSelfDiff();
          }
        }
        category: {
          if (ignoreDiff) {
            break category;
          }
          if (node.actual.wellKnownId !== node.expected.wellKnownId) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
          const actualIsPrimitive = node.actual.isPrimitive;
          const expectedIsPrimitive = node.expected.isPrimitive;
          if (actualIsPrimitive !== expectedIsPrimitive) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
          if (
            actualIsPrimitive &&
            expectedIsPrimitive &&
            node.actual.value !== node.expected.value
          ) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
          const actualIsComposite = node.actual.isComposite;
          const expectedIsComposite = node.expected.isComposite;
          if (actualIsComposite !== expectedIsComposite) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
          // maybe array check not needed as subtype will differ
          const actualIsArray = node.actual.isArray;
          const expectedIsArray = node.expected.isArray;
          if (actualIsArray !== expectedIsArray) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
          const actualSubtype = node.actual.subtype;
          const expectedSubtype = node.expected.subtype;
          if (actualSubtype !== expectedSubtype) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
        }
        // node.after.value is a reference: was already traversed
        // - prevent infinite recursion for circular structure
        // - prevent traversing a structure already known
        const actualStructureIsKnown = Boolean(
          node.actual.wellKnownId || node.actual.reference,
        );
        // node.after.value is a reference: was already traversed
        // - prevent infinite recursion for circular structure
        // - prevent traversing a structure already known
        const expectedStructureIsKnown = Boolean(
          node.expected.wellKnownId || node.expected.reference,
        );
        prototype: {
          if (ignoreDiff) {
            break prototype;
          }
          const visitActualPrototype =
            node.actual.isComposite && !actualStructureIsKnown;
          const visitExpectedPrototype =
            node.expected.isComposite && !expectedStructureIsKnown;
          if (!visitActualPrototype && !visitExpectedPrototype) {
            break prototype;
          }
          const canDiffPrototypes =
            visitActualPrototype && visitExpectedPrototype;
          const prototypeAreDifferentAndWellKnown =
            (node.actual.isArray && !node.expected.isArray) ||
            (!node.actual.isArray && node.expected.isArray);
          node.canDiffPrototypes = canDiffPrototypes;
          node.prototypeAreDifferentAndWellKnown =
            prototypeAreDifferentAndWellKnown;

          const actualPrototype = visitActualPrototype
            ? Object.getPrototypeOf(node.actual.value)
            : undefined;
          const expectedPrototype = visitExpectedPrototype
            ? Object.getPrototypeOf(node.expected.value)
            : undefined;
          const prototypeNode = node.appendPrototype({
            actualPrototype,
            expectedPrototype,
          });
          visit(prototypeNode, {
            ignoreDiff:
              ignoreDiff ||
              node.diff.category ||
              prototypeAreDifferentAndWellKnown,
          });
          if (prototypeNode.diff.counters.overall.any) {
            appendCounters(
              node.diff.counters.inside,
              prototypeNode.diff.counters.overall,
            );
          }
        }
        value_of_return_value: {
          const visitActualValueOfReturnValue =
            node.actual.isComposite &&
            !actualStructureIsKnown &&
            "valueOf" in node.actual.value &&
            typeof node.actual.value.valueOf === "function";
          const visitExpectedValueOfReturnValue =
            node.expected.isComposite &&
            !expectedStructureIsKnown &&
            "valueOf" in node.expected.value &&
            typeof node.expected.value.valueOf === "function";
          const canDiffValueOfReturnValue =
            visitActualValueOfReturnValue && visitExpectedValueOfReturnValue;
          node.canDiffValueOfReturnValue = canDiffValueOfReturnValue;
          if (
            !visitActualValueOfReturnValue &&
            !visitExpectedValueOfReturnValue
          ) {
            break value_of_return_value;
          }
          if (node.actual.reference && !visitExpectedValueOfReturnValue) {
            // prevent infinite recursion on actual.valueOf()
            // while expected.valueOf() stops existing
            break value_of_return_value;
          }
          if (node.expected.reference && !visitActualValueOfReturnValue) {
            // prevent infinite recursion on expected.valueOf()
            // while actual.valueOf() stops existing
            break value_of_return_value;
          }
          if (node.actual.reference && node.expected.reference) {
            // prevent infinite recursion when both actual.valueOf()
            // and expected.valueOf() exists and use references
            break value_of_return_value;
          }

          const actualValueOfReturnValue = visitActualValueOfReturnValue
            ? node.actual.value.valueOf()
            : node.actual.value;
          const expectedValueOfReturnValue = visitExpectedValueOfReturnValue
            ? node.expected.value.valueOf()
            : node.expected.value;
          const valueOfReturnValueNode = node.appendValueOfReturnValue({
            actualValueOfReturnValue,
            expectedValueOfReturnValue,
          });
          let ignoreValueOfDiff = ignoreDiff;
          if (
            node.diff.category &&
            // String/string comparison is ok
            node.actual.subtype.toLowerCase() !==
              node.expected.subtype.toLowerCase()
          ) {
            ignoreValueOfDiff = true;
          } else if (
            node.diff.prototype &&
            node.diff.prototype.counters.overall.any > 0
          ) {
            ignoreValueOfDiff = true;
          }
          visit(valueOfReturnValueNode, {
            ignoreDiff: ignoreValueOfDiff,
          });

          if (valueOfReturnValueNode.diff.counters.overall.any) {
            appendCounters(
              node.diff.counters.inside,
              valueOfReturnValueNode.diff.counters.overall,
            );
          }
          // else if (ignoreValueOfDiff) {
          //   valueOfReturnValueNode.actual.redundant = true;
          //   valueOfReturnValueNode.actualValueOfReturnValue.redundant = true;
          // }
          else {
            if (actualValueOfReturnValue === node.actual.value) {
              valueOfReturnValueNode.actual.redundant = true;
            }
            if (expectedValueOfReturnValue === node.expected.value) {
              valueOfReturnValueNode.expected.redundant = true;
            }
          }
        }
        inside: {
          string: {
            lines: {
              const visitActualLines =
                node.actual.canHaveLines && !actualStructureIsKnown;
              const visitExpectedLines =
                node.expected.canHaveLines && !expectedStructureIsKnown;
              const canDiffLines = visitActualLines && visitExpectedLines;
              node.canDiffLines = canDiffLines;

              const actualLines = visitActualLines
                ? node.actual.value.split(/\r?\n/)
                : [];
              const expectedLines = visitExpectedLines
                ? node.expected.value.split(/\r?\n/)
                : [];
              node.actual.lines = actualLines;
              node.expected.lines = expectedLines;
              const visitLine = (lineIndex) => {
                const actualHasOwn = visitActualLines
                  ? Object.hasOwn(actualLines, lineIndex)
                  : false;
                const expectedHasOwn = visitExpectedLines
                  ? Object.hasOwn(expectedLines, lineIndex)
                  : false;
                const actualLine = actualHasOwn
                  ? actualLines[lineIndex]
                  : undefined;
                const expectedLine = expectedHasOwn
                  ? expectedLines[lineIndex]
                  : undefined;
                const lineNode = node.appendLine({
                  actualLine,
                  expectedLine,
                });

                if (expectedHasOwn && !actualHasOwn && visitActualLines) {
                  lineNode.diff.removed = true;
                  if (canDiffLines && !ignoreDiff) {
                    lineNode.diff.counters.self.removed++;
                    addNodeCausingDiff(lineNode);
                  }
                }
                if (!expectedHasOwn && actualHasOwn && visitExpectedLines) {
                  lineNode.diff.added = true;
                  if (canDiffLines && !ignoreDiff) {
                    lineNode.diff.counters.self.added++;
                    addNodeCausingDiff(lineNode);
                  }
                }
                visit(lineNode, {
                  ignoreDiff:
                    ignoreDiff ||
                    !canDiffLines ||
                    lineNode.diff.removed ||
                    lineNode.diff.added,
                });
                appendCounters(
                  node.diff.counters.inside,
                  lineNode.diff.counters.overall,
                );
              };

              let expectedLineIndex = 0;
              while (expectedLineIndex < expectedLines.length) {
                visitLine(expectedLineIndex);
                expectedLineIndex++;
              }
              let actualExtraLineIndex = expectedLineIndex;
              while (actualExtraLineIndex < actualLines.length) {
                visitLine(actualExtraLineIndex);
                actualExtraLineIndex++;
              }
            }
            chars: {
              const visitActualChars =
                node.actual.canHaveChars && !actualStructureIsKnown;
              const visitExpectedChars =
                node.expected.canHaveChars && !expectedStructureIsKnown;
              const canDiffChars = visitActualChars && visitExpectedChars;
              node.canDiffChars = canDiffChars;
              const actualChars = visitActualChars
                ? splitChars(node.actual.value)
                : [];
              node.actual.chars = actualChars;
              const expectedChars = visitExpectedChars
                ? splitChars(node.expected.value)
                : [];
              node.expected.chars = expectedChars;

              const visitChar = (index) => {
                const actualHasOwn = visitActualChars
                  ? Object.hasOwn(actualChars, index)
                  : false;
                const expectedHasOwn = visitExpectedChars
                  ? Object.hasOwn(expectedChars, index)
                  : false;
                const actualChar = actualHasOwn
                  ? actualChars[index]
                  : undefined;
                const expectedChar = expectedHasOwn
                  ? expectedChars[index]
                  : undefined;
                const charNode = node.appendChar({
                  actualChar,
                  expectedChar,
                });

                if (expectedHasOwn && !actualHasOwn && visitActualChars) {
                  charNode.diff.removed = true;
                  if (canDiffChars && !ignoreDiff) {
                    charNode.diff.counters.self.removed++;
                    addNodeCausingDiff(charNode);
                  }
                }
                if (!expectedHasOwn && actualHasOwn && visitExpectedChars) {
                  charNode.diff.added = true;
                  if (canDiffChars && !ignoreDiff) {
                    charNode.diff.counters.self.added++;
                    addNodeCausingDiff(charNode);
                  }
                }
                visit(charNode, {
                  ignoreDiff:
                    ignoreDiff ||
                    !canDiffChars ||
                    charNode.diff.removed ||
                    charNode.diff.added,
                });
                appendCounters(
                  node.diff.counters.inside,
                  charNode.diff.counters.overall,
                );
              };

              let expectedCharIndex = 0;
              while (expectedCharIndex < expectedChars.length) {
                visitChar(expectedCharIndex);
                expectedCharIndex++;
              }
              let actualExtraCharIndex = expectedCharIndex;
              while (actualExtraCharIndex < actualChars.length) {
                visitChar(actualExtraCharIndex);
                actualExtraCharIndex++;
              }
            }
          }

          indexed_values: {
            const visitActualIndexedValues =
              node.actual.canHaveIndexedValues && !actualStructureIsKnown;
            const visitExpectedIndexedValues =
              node.expected.canHaveIndexedValues && !expectedStructureIsKnown;
            const canDiffIndexedValues =
              visitActualIndexedValues && visitExpectedIndexedValues;
            node.canDiffIndexedValues = canDiffIndexedValues;

            const visitIndexedValue = (index) => {
              const actualHasOwn = visitActualIndexedValues
                ? Object.hasOwn(node.actual.value, index)
                : false;
              const expectedHasOwn = visitExpectedIndexedValues
                ? Object.hasOwn(node.expected.value, index)
                : false;
              const actualValue = actualHasOwn
                ? node.actual.value[index]
                : visitActualIndexedValues && index < node.actual.value.length
                  ? ARRAY_EMPTY_VALUE
                  : undefined;
              const expectedValue = expectedHasOwn
                ? node.expected.value[index]
                : visitExpectedIndexedValues &&
                    index < node.expected.value.length
                  ? ARRAY_EMPTY_VALUE
                  : undefined;
              const indexedValueNode = node.appendIndexedValue(index, {
                actualValue,
                expectedValue,
              });

              if (
                (expectedHasOwn || expectedValue === ARRAY_EMPTY_VALUE) &&
                !actualHasOwn &&
                actualValue !== ARRAY_EMPTY_VALUE &&
                visitActualIndexedValues
              ) {
                indexedValueNode.diff.removed = true;
                if (canDiffIndexedValues && !ignoreDiff) {
                  indexedValueNode.diff.counters.self.removed++;
                  addNodeCausingDiff(indexedValueNode);
                }
              }
              if (
                !expectedHasOwn &&
                expectedValue !== ARRAY_EMPTY_VALUE &&
                (actualHasOwn || actualValue === ARRAY_EMPTY_VALUE) &&
                visitExpectedIndexedValues
              ) {
                indexedValueNode.diff.added = true;
                if (canDiffIndexedValues && !ignoreDiff) {
                  indexedValueNode.diff.counters.self.added++;
                  addNodeCausingDiff(indexedValueNode);
                }
              }
              visit(indexedValueNode, {
                ignoreDiff:
                  ignoreDiff ||
                  !canDiffIndexedValues ||
                  indexedValueNode.diff.removed ||
                  indexedValueNode.diff.added,
              });
              appendCounters(
                node.diff.counters.inside,
                indexedValueNode.diff.counters.overall,
              );
            };
            if (visitExpectedIndexedValues) {
              let index = 0;
              while (index < node.expected.value.length) {
                visitIndexedValue(index);
                index++;
              }
            }
            if (visitActualIndexedValues) {
              let index = node.expected.value.length;
              while (index < node.actual.value.length) {
                visitIndexedValue(index);
                index++;
              }
            }
          }
          properties: {
            const visitActualProps =
              node.actual.canHaveProps && !actualStructureIsKnown;
            const visitExpectedProps =
              node.expected.canHaveProps && !expectedStructureIsKnown;
            const canDiffProps = visitActualProps && visitExpectedProps;
            node.canDiffProps = canDiffProps;

            // here we want to traverse before and after but if they are not composite
            // we'll consider everything as removed or added, depending the scenario
            const visitProperty = (property) => {
              const actualPropertyDescriptor = visitActualProps
                ? Object.getOwnPropertyDescriptor(node.actual.value, property)
                : null;
              const expectedPropertyDescriptor = visitExpectedProps
                ? Object.getOwnPropertyDescriptor(node.expected.value, property)
                : null;
              const propertyNode = node.appendProperty(property, {
                actualPropertyDescriptor,
                expectedPropertyDescriptor,
              });

              if (
                !actualPropertyDescriptor &&
                expectedPropertyDescriptor &&
                visitActualProps
              ) {
                propertyNode.diff.removed = true;
                if (canDiffProps && !ignoreDiff) {
                  propertyNode.diff.counters.self.removed++;
                  addNodeCausingDiff(propertyNode);
                }
              }
              if (
                actualPropertyDescriptor &&
                !expectedPropertyDescriptor &&
                visitExpectedProps
              ) {
                propertyNode.diff.added = true;
                if (canDiffProps && !ignoreDiff) {
                  propertyNode.diff.counters.self.added++;
                  addNodeCausingDiff(propertyNode);
                }
              }
              visit(propertyNode, {
                ignoreDiff:
                  ignoreDiff ||
                  !canDiffProps ||
                  propertyNode.diff.removed ||
                  propertyNode.diff.added,
              });
              appendCounters(
                node.diff.counters.inside,
                propertyNode.diff.counters.overall,
              );
            };
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
            const shouldIgnore = (valueInfo, property) => {
              if (valueInfo.isArray) {
                if (property === "length") {
                  return true;
                }
                if (isArrayIndex(property)) {
                  return true;
                }
              }
              if (valueInfo.isComposite && valueInfo.subtype === "String") {
                if (property === "length") {
                  return true;
                }
                if (isArrayIndex(property)) {
                  return true;
                }
              }
              if (node.valueOfReturnValue && property === "valueOf") {
                return true;
              }
              return false;
            };

            const expectedKeys = [];
            if (visitExpectedProps) {
              const expectedPropertyNames = Object.getOwnPropertyNames(
                node.expected.value,
              );
              for (const expectedPropertyName of expectedPropertyNames) {
                if (shouldIgnore(node.expected, expectedPropertyName)) {
                  continue;
                }
                expectedKeys.push(expectedPropertyName);
                visitProperty(expectedPropertyName);
              }
            }
            node.expected.keys = expectedKeys;

            const actualKeys = [];
            if (visitActualProps) {
              const actualPropertyNames = Object.getOwnPropertyNames(
                node.actual.value,
              );
              for (const actualPropertyName of actualPropertyNames) {
                if (shouldIgnore(node.actual, actualPropertyName)) {
                  continue;
                }
                actualKeys.push(actualPropertyName);
                if (!node.properties[actualPropertyName]) {
                  visitProperty(actualPropertyName);
                }
              }
            }
            node.actual.keys = actualKeys;
          }
        }
      };

      doVisit();
      settleCounters(node);
    };
    visit(rootComparison);
    if (causeSet.size === 0) {
      return;
    }

    let startNode = rootComparison;
    const [firstNodeCausingDiff] = causeSet;
    if (
      firstNodeCausingDiff.expected.depth >= maxDepth &&
      !rootComparison.diff.category
    ) {
      const nodesFromRootToTarget = [firstNodeCausingDiff];
      let currentNode = firstNodeCausingDiff;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const parentNode = currentNode.parent;
        if (parentNode) {
          nodesFromRootToTarget.unshift(parentNode);
          currentNode = parentNode;
        } else {
          break;
        }
      }
      let startNodeDepth = firstNodeCausingDiff.expected.depth - maxDepth;
      let valuePath = createValuePath();
      for (const node of nodesFromRootToTarget) {
        if (
          startNode === rootComparison &&
          node.type === "property_descriptor" &&
          node.expected.depth > startNodeDepth
        ) {
          node.path = String(valuePath);
          startNode = node;
          break;
        }
        const { type } = node;
        if (node === rootComparison) {
          continue;
        }
        if (type === "property") {
          valuePath = valuePath.append(node.property);
          continue;
        }
        if (type === "property_descriptor") {
          if (node.descriptor === "value") {
            continue;
          }
          valuePath = valuePath.append(node.descriptor, { special: true });
          continue;
        }
        if (type === "indexed_value") {
          valuePath = valuePath.append(node.index);
          continue;
        }
        if (type === "char") {
          valuePath = valuePath.append(node.index);
          continue;
        }
        if (type === "line") {
          valuePath = valuePath.append(node.index);
          continue;
        }
      }
    }

    const actualValueMeta = {
      resultType: "actual",
      name: "actual",
      color: unexpectedColor,
    };
    const expectedValueMeta = {
      resultType: "expected",
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
    const firstValueDiff = writeDiff(startNode, {
      onNodeDisplayed,
      refId: 1,
      startNode,
      signs,
      initialDepth: -startNode.expected.depth,
      maxColumns,
      textIndent: stringWidth(firstPrefix),
      maxDiffPerObject,
      maxDepth,
      maxValueBeforeDiff,
      maxValueAfterDiff,
      maxValueInsideDiff,
      maxDepthInsideDiff,
      maxLineBeforeDiff,
      maxLineAfterDiff,
      resultType: firstValueMeta.resultType,
      quote,
      preserveLineBreaks,
    });

    let secondPrefix = "";
    secondPrefix += ANSI.color(secondValueMeta.name, sameColor);
    secondPrefix += ANSI.color(":", sameColor);
    secondPrefix += " ";
    const secondValueDiff = writeDiff(startNode, {
      onNodeDisplayed,
      refId: 1,
      startNode,
      signs,
      initialDepth: -startNode.expected.depth,
      maxColumns,
      textIndent: stringWidth(secondPrefix),
      maxDiffPerObject,
      maxDepth,
      maxValueBeforeDiff,
      maxValueAfterDiff,
      maxValueInsideDiff,
      maxDepthInsideDiff,
      maxLineBeforeDiff,
      maxLineAfterDiff,
      resultType: secondValueMeta.resultType,
      quote,
      preserveLineBreaks,
    });

    let diffMessage = "";
    diffMessage += firstPrefix;
    diffMessage += firstValueDiff;
    diffMessage += "\n";
    diffMessage += secondPrefix;
    diffMessage += secondValueDiff;

    let message;
    if (rootComparison.diff.category && causeCounters.total === 1) {
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
    if (startNode !== rootComparison) {
      infos.push(`diff starts at ${ANSI.color(startNode.path, ANSI.YELLOW)}`);
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

let createComparisonTree;
{
  createComparisonTree = (actualValue, expectedValue) => {
    const compositeReferenceMap = new Map();
    let nodeId = 1;

    const createComparisonNode = ({
      type,
      actualValue,
      expectedValue,
      parent,
    }) => {
      const node = {
        id: nodeId++,
        type,
        parent,
        actual: createValueInfo(actualValue, {
          parent,
          type,
          name: "actual",
        }),
        expected: createValueInfo(expectedValue, {
          parent,
          type,
          name: "expected",
        }),
        prototype: null,
        valueOfReturnValue: null,
        properties: {},
        indexedValues: [],
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
          properties: {},
          indexedValues: [],
        },
      };
      const expectedReference = node.expected.isComposite
        ? compositeReferenceMap.get(expectedValue)
        : undefined;
      const actualReference = node.actual.isComposite
        ? compositeReferenceMap.get(actualValue)
        : undefined;
      node.expected.reference = expectedReference;
      node.actual.reference = actualReference;
      if (node.expected.isComposite) {
        if (expectedReference) {
          expectedReference.expected.referenceFromOthersSet.add(node);
        } else {
          compositeReferenceMap.set(expectedValue, node);
        }
      }
      if (node.actual.isComposite) {
        if (actualReference) {
          actualReference.actual.referenceFromOthersSet.add(node);
        } else {
          compositeReferenceMap.set(actualValue, node);
        }
      }

      if (node.actual.isComposite || node.expected.isComposite) {
        node.appendPrototype = ({ actualPrototype, expectedPrototype }) => {
          const prototypeNode = createComparisonNode({
            type: "prototype",
            actualValue: actualPrototype,
            expectedValue: expectedPrototype,
            parent: node,
          });
          node.prototype = prototypeNode;
          node.diff.prototype = prototypeNode.diff;
          return prototypeNode;
        };
        node.appendValueOfReturnValue = ({
          actualValueOfReturnValue,
          expectedValueOfReturnValue,
        }) => {
          const valueOfReturnValueNode = createComparisonNode({
            type: "value_of_return_value",
            actualValue: actualValueOfReturnValue,
            expectedValue: expectedValueOfReturnValue,
            parent: node,
          });
          node.valueOfReturnValue = valueOfReturnValueNode;
          node.diff.valueOfReturnValue = valueOfReturnValueNode.diff;
          return valueOfReturnValueNode;
        };
        node.appendProperty = (
          property,
          { actualPropertyDescriptor, expectedPropertyDescriptor },
        ) => {
          const propertyNode = createComparisonNode({
            type: "property",
            actualValue: actualPropertyDescriptor,
            expectedValue: expectedPropertyDescriptor,
            parent: node,
          });
          propertyNode.property = property;
          node.properties[property] = propertyNode;
          propertyNode.diff = {
            counters: propertyNode.diff.counters,
            added: false,
            removed: false,
            value: null,
            enumerable: null,
            writable: null,
            configurable: null,
            set: null,
            get: null,
          };
          node.diff.properties[property] = propertyNode.diff;

          propertyNode.descriptors = {
            value: null,
            enumerable: null,
            writable: null,
            configurable: null,
            set: null,
            get: null,
          };
          propertyNode.appendPropertyDescriptor = (
            name,
            { actualValue, expectedValue },
          ) => {
            const propertyDescriptorNode = createComparisonNode({
              type: "property_descriptor",
              actualValue,
              expectedValue,
              parent: propertyNode,
            });
            propertyDescriptorNode.property = property;
            propertyDescriptorNode.descriptor = name;
            propertyNode.descriptors[name] = propertyDescriptorNode;
            return propertyDescriptorNode;
          };
          return propertyNode;
        };
      }
      if (
        node.actual.canHaveIndexedValues ||
        node.expected.canHaveIndexedValues
      ) {
        node.appendIndexedValue = (index, { actualValue, expectedValue }) => {
          const indexedValueNode = createComparisonNode({
            type: "indexed_value",
            actualValue,
            expectedValue,
            parent: node,
          });
          indexedValueNode.index = index;
          node.indexedValues[index] = indexedValueNode;
          return indexedValueNode;
        };
      }
      if (node.actual.canHaveLines || node.expected.canHaveLines) {
        node.lines = [];
        node.appendLine = ({ actualLine, expectedLine }) => {
          const lineNode = createComparisonNode({
            type: "line",
            actualValue: actualLine,
            expectedValue: expectedLine,
            parent: node,
          });
          const lineIndex = node.lines.length;
          lineNode.index = lineIndex;
          node.lines[lineIndex] = lineNode;
          return lineNode;
        };
      }
      if (node.actual.canHaveChars || node.expected.canHaveChars) {
        node.chars = [];
        node.appendChar = ({ actualChar, expectedChar }) => {
          const charNode = createComparisonNode({
            type: "char",
            actualValue: actualChar,
            expectedValue: expectedChar,
            parent: node,
          });
          const charIndex = node.chars.length;
          charNode.index = charIndex;
          node.chars[charIndex] = charNode;
          return charNode;
        };
      }
      return node;
    };

    const createValueInfo = (value, { name, type, parent }) => {
      let composite;
      let wellKnownId;
      let subtype;
      let isArray;
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
        } else {
          isArray = false;
          if (value === null) {
            subtype = "null";
          } else {
            subtype = typeof value;
          }
        }
      }

      const isString = subtype === "string";
      const canHaveIndexedValues = isArray;
      const canHaveLines =
        (isString || subtype === "String") &&
        type !== "line" &&
        type !== "char";
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
        const parentValueInfo = parent[name];
        // we display in constructor if parent subtype is not Object nor Array
        // (if there is a constructor displayed)
        const parentSubtype = parentValueInfo.subtype;
        if (parentSubtype !== "Object" && parentSubtype !== "Array") {
          inConstructor = true;
        }
      }

      let depth;
      if (parent) {
        if (type === "property") {
          depth = parent[name].depth;
        } else if (type === "value_of_return_value" && inConstructor) {
          depth = parent[name].depth;
        } else {
          depth = parent[name].depth + 1;
        }
      } else {
        depth = 0;
      }

      return {
        depth,
        value,
        valueOf: () => {
          throw new Error(`use ${name}.value`);
        },
        subtype,
        isComposite: composite,
        isPrimitive: !composite,
        isArray,
        isString,
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
      };
    };

    const root = createComparisonNode({
      type: "value",
      actualValue,
      expectedValue,
    });

    return { root };
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
}

let writeDiff;
{
  writeDiff = (node, context) => {
    const method = methods[node.type];
    if (!method) {
      throw new Error(`unknown node type: ${node.type}`);
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

  const writeValueDiff = (node, context) => {
    const valueContext = { ...context };
    if (!context.modified && node.diff.counters.self.any > 0) {
      valueContext.modified = true;
    }
    const valueInfo = node[valueContext.resultType];
    const relativeDepth = valueInfo.depth + context.initialDepth;
    valueContext.insideOverview = valueContext.collapsed !== true;
    if (!valueContext.collapsed) {
      valueContext.collapsed =
        relativeDepth >= valueContext.maxDepth ||
        node.diff.counters.overall.any === 0;
    }

    const valueColor = getValueColor(valueContext);
    const delimitersColor = getDelimitersColor(valueContext);
    const bracketColor = getBracketColor(node, valueContext);

    if (valueInfo.wellKnownId) {
      return ANSI.color(valueInfo.wellKnownId, valueColor);
    }

    // primitive
    if (valueInfo.isPrimitive) {
      const value = valueInfo.value;
      if (valueInfo.canHaveLines) {
        const string = value;
        if (valueContext.collapsed) {
          if (!node.quote) {
            const quote =
              context.quote === "auto" ? pickBestQuote(string) : context.quote;
            node.quote = quote; // ensure the quote in expected is "forced" to the one in actual
          }
          let stringOverviewDiff = "";
          stringOverviewDiff += ANSI.color(node.quote, bracketColor);
          const quoteWidth = node.quote.length;
          const remainingWidth =
            valueContext.maxColumns - valueContext.textIndent;
          let maxWidth = Math.min(remainingWidth, 10);
          maxWidth -= quoteWidth + quoteWidth;
          let stringDiff;
          const width = stringWidth(string);
          if (width > maxWidth) {
            stringDiff = string.slice(0, maxWidth - "…".length);
            stringDiff += "…";
          } else {
            stringDiff = string;
          }
          stringOverviewDiff += ANSI.color(stringDiff, valueColor);
          stringOverviewDiff += ANSI.color(node.quote, bracketColor);
          return stringOverviewDiff;
        }

        let stringDiff = "";
        valueContext.modified = node.canDiffLines
          ? context.modified
          : valueContext.modified;
        stringDiff += writeExpandedDiff(node, valueContext, context);
        return stringDiff;
      }

      if (valueInfo.isString) {
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
      return ANSI.color(valueDiff, valueColor);
    }

    if (context.collapsed && node.type === "property_descriptor") {
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

    let idCount = 0;
    const displayedIdMap = new Map();
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

    // composite
    let compositeDiff = "";
    reference: {
      // referencing an other composite
      if (valueInfo.reference) {
        compositeDiff += ANSI.color(
          `<ref #${getDisplayedId(valueInfo.reference.id)}>`,
          delimitersColor,
        );
        return compositeDiff;
      }
      // will be referenced by a composite
      let referenceFromOtherDisplayed;
      for (const referenceFromOther of valueInfo.referenceFromOthersSet) {
        if (
          referenceFromOther.type === "value_of_return_value" &&
          referenceFromOther[context.resultType].redundant
        ) {
          continue;
        }
        referenceFromOtherDisplayed = referenceFromOther;
        break;
      }
      if (referenceFromOtherDisplayed) {
        compositeDiff += ANSI.color(
          `<ref #${getDisplayedId(
            referenceFromOtherDisplayed[context.resultType].reference.id,
          )}>`,
          delimitersColor,
        );
        compositeDiff += " ";
      }
    }

    inside: {
      if (valueContext.collapsed) {
        if (valueContext.insideOverview) {
          const overviewDiff = writeOverviewDiff(node, valueContext, context);
          compositeDiff += overviewDiff;
        } else {
          const collapsedDiff = writeCollapsedDiff(node, valueContext, context);
          compositeDiff += collapsedDiff;
        }
      } else {
        const expandedDiff = writeExpandedDiff(node, valueContext, context);
        compositeDiff += expandedDiff;
      }
    }
    return compositeDiff;
  };
  const writeNestedValueDiff = (node, context) => {
    if (
      node.type === "value_of_return_value" &&
      node[context.resultType].inConstructor
    ) {
      return writeValueDiff(node, context);
    }
    const nestedValueContext = { ...context };
    if (node.type === "line") {
      if (node.diff.removed) {
        nestedValueContext.removed = true;
      }
      if (node.diff.added) {
        nestedValueContext.added = true;
      }
    }
    if (node.type === "char") {
      if (node.diff.removed) {
        nestedValueContext.removed = true;
      }
      if (node.diff.added) {
        nestedValueContext.added = true;
      }
    }
    if (node.type === "indexed_value") {
      if (node.diff.removed) {
        nestedValueContext.removed = true;
      }
      if (node.diff.added) {
        nestedValueContext.added = true;
      }
    }
    if (node.type === "property_descriptor") {
      if (node.parent.diff.removed) {
        nestedValueContext.removed = true;
      }
      if (node.parent.diff.added) {
        nestedValueContext.added = true;
      }
      if (
        isDefaultDescriptor(
          node.descriptor,
          node[nestedValueContext.resultType].value,
        )
      ) {
        return "";
      }
    }

    let nestedValueDiff = "";
    const valueInfo = node[context.resultType];
    const relativeDepth = valueInfo.depth + nestedValueContext.initialDepth;
    let indent = `  `.repeat(relativeDepth);
    const keyColor = getKeyColor(nestedValueContext);
    const delimitersColor = getDelimitersColor(nestedValueContext);
    let displayValue = true;

    const useIndent =
      !nestedValueContext.collapsed &&
      (node.type === "indexed_value" ||
        node.type === "property_descriptor" ||
        node.type === "prototype" ||
        node.type === "value_of_return_value");
    if (useIndent) {
      if (nestedValueContext.signs) {
        if (nestedValueContext.removed) {
          if (nestedValueContext.resultType === "expected") {
            nestedValueDiff += ANSI.color(removedSign, removedSignColor);
            indent = indent.slice(1);
          }
        } else if (nestedValueContext.added) {
          if (nestedValueContext.resultType === "actual") {
            nestedValueDiff += ANSI.color(addedSign, addedSignColor);
            indent = indent.slice(1);
          }
        } else if (nestedValueContext.modified) {
          if (nestedValueContext.resultType === "actual") {
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
            : "";
    if (property && node !== nestedValueContext.startNode) {
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
    const separator =
      useIndent &&
      node !== nestedValueContext.startNode &&
      (!valueInfo.canHaveLines || node.lines.length === 1)
        ? ","
        : "";
    if (displayValue) {
      nestedValueContext.textIndent += stringWidth(nestedValueDiff);
      nestedValueContext.maxColumns -= separator.length;
      if (nestedValueContext.modified) {
        nestedValueContext.maxDepth = Math.min(
          valueInfo.depth + nestedValueContext.maxDepthInsideDiff,
          nestedValueContext.maxDepth,
        );
      }
      const valueDiff = writeValueDiff(node, nestedValueContext);
      nestedValueDiff += valueDiff;
    }
    if (separator) {
      nestedValueDiff += ANSI.color(separator, delimitersColor);
    }
    return nestedValueDiff;
  };
  const writePrefix = (node, context, parentContext, { overview } = {}) => {
    const valueInfo = node[context.resultType];
    let prefix = "";

    const displayValueOfInsideConstructor =
      valueInfo.isComposite &&
      // value returned by valueOf() is not the composite itself
      node.valueOfReturnValue &&
      node.valueOfReturnValue[context.resultType].inConstructor &&
      !node.valueOfReturnValue[context.resultType].redundant;
    let displaySubtype = true;
    if (overview) {
      displaySubtype = true;
    } else if (
      valueInfo.subtype === "Object" ||
      valueInfo.subtype === "Array"
    ) {
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
        node.actual.isComposite &&
        node.expected.isComposite &&
        node.actual.subtype === node.expected.subtype
      ) {
        subtypeColor = sameColor;
      } else if (
        node.actual.isComposite === node.expected.isComposite &&
        node.actual.canHaveLines &&
        node.expected.canHaveLines
      ) {
        subtypeColor = sameColor;
      } else {
        subtypeColor =
          context.resultType === "actual" ? unexpectedColor : expectedColor;
      }
      prefix += ANSI.color(valueInfo.subtype, subtypeColor);
    }
    if (valueInfo.isArray) {
      if (!overview) {
        return prefix;
      }
      prefix += ANSI.color(`(`, delimitersColor);
      let lengthColor = context.added
        ? addedColor
        : context.removed
          ? removedColor
          : node.actual.isArray &&
              node.expected.isArray &&
              node.actual.value.length === node.expected.value.length
            ? sameColor
            : context.resultType === "actual"
              ? unexpectedColor
              : expectedColor;
      prefix += ANSI.color(valueInfo.value.length, lengthColor);
      prefix += ANSI.color(`)`, delimitersColor);
      return prefix;
    }
    if (valueInfo.isString) {
      if (!overview) {
        return prefix;
      }
      prefix += ANSI.color(`(`, delimitersColor);
      let lengthColor = context.added
        ? addedColor
        : context.removed
          ? removedColor
          : node.actual.isString &&
              node.expected.isString &&
              node.actual.chars.length === node.expected.chars.length
            ? sameColor
            : context.resultType === "actual"
              ? unexpectedColor
              : expectedColor;
      prefix += ANSI.color(valueInfo.chars.length, lengthColor);
      prefix += ANSI.color(`)`, delimitersColor);
      return prefix;
    }
    if (valueInfo.isComposite) {
      let insideConstructor = "";
      const prefixWithNew =
        valueInfo.subtype === "String" ||
        valueInfo.subtype === "Boolean" ||
        valueInfo.subtype === "Number";
      if (prefixWithNew) {
        prefix = `${ANSI.color(`new`, delimitersColor)} ${prefix}`;
      }

      if (displayValueOfInsideConstructor) {
        insideConstructor = writeDiff(node.valueOfReturnValue, parentContext);
        // if (overview) {
        //   insideConstructor = writeDiff(node.valueOfReturnValue, parentContext);
        // } else {
        //   insideConstructor = writeValueDiff(node.valueOfReturnValue, context);
        // }
      } else if (overview) {
        let keysColor;
        if (context.added) {
          keysColor = addedColor;
        } else if (context.removed) {
          keysColor = removedColor;
        } else if (
          node.actual.isComposite &&
          node.expected.isComposite &&
          node.actual.keys.length === node.expected.keys.length
        ) {
          keysColor = sameColor;
        } else if (context.resultType === "actual") {
          keysColor = unexpectedColor;
        } else {
          keysColor = expectedColor;
        }
        insideConstructor = ANSI.color(valueInfo.keys.length, keysColor);
      }
      if (insideConstructor) {
        prefix += ANSI.color("(", delimitersColor);
        prefix += insideConstructor;
        prefix += ANSI.color(")", delimitersColor);
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

  const writeLinesDiff = (node, context, parentContext) => {
    const lineNodes = node.lines;
    empty_string: {
      const firstLineNode = lineNodes[0];
      const firstLineValueInfo = firstLineNode[context.resultType];
      if (firstLineValueInfo.value.length === 0) {
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
      if (!node.quote) {
        const valueInfo = node[context.resultType];
        const quote =
          context.quote === "auto"
            ? pickBestQuote(valueInfo.value)
            : context.quote;
        node.quote = quote; // ensure the quote in expected is "forced" to the one in actual
      }
      const focusedCharIndex = getFocusedCharIndex(firstLineNode, context);
      return writeOneLineDiff(
        firstLineNode,
        {
          ...context,
          removed: firstLineNode.diff.removed,
          added: firstLineNode.diff.added,
          modified: firstLineNode.canDiffChars
            ? parentContext.modified
            : context.modified,
          focusedCharIndex,
        },
        context,
      );
    }

    multiline: {
      const lines = node[context.resultType].lines;
      let focusedLineIndex = lines.findIndex((line, index) => {
        const lineNode = lineNodes[index];
        return lineNode.diff.counters.overall.any > 0;
      });
      if (focusedLineIndex === -1) {
        focusedLineIndex = lines.length - 1;
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
        const hasNextLine = nextLineIndex < lines.length;
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
        lines.length - 1 - focusedLineIndex - lineAfterArray.length;
      if (nextLineRemaining === 1) {
        lineAfterArray.push(lineNodes[lines.length - 1]);
        nextLineRemaining = 0;
      }

      const writeLineDiff = (lineNode) => {
        const lineContext = {
          ...context,
          removed: lineNode.diff.removed,
          added: lineNode.diff.added,
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
        const to = lines.length;
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
        belowSummary += ANSI.color(
          `${skippedCounters.total} lines`,
          node.actual.lines.length === node.expected.lines.length
            ? delimitersColor
            : context.resultType === "actual"
              ? unexpectedColor
              : expectedColor,
        );
        const parts = [];
        if (skippedCounters.modified) {
          parts.push(
            ANSI.color(
              `${skippedCounters.modified} modified`,
              context.resultType === "actual" ? unexpectedColor : expectedColor,
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

  const writeExpandedDiff = (node, context, parentContext) => {
    const valueInfo = node[context.resultType];
    if (valueInfo.isString && valueInfo.canHaveLines) {
      return writeLinesDiff(node, context, parentContext);
    }

    let expandedDiff = "";
    let insideDiff = "";

    let prefix = writePrefix(node, context, parentContext);
    expandedDiff += prefix;

    const delimitersColor = getDelimitersColor(context);
    const relativeDepth = valueInfo.depth + context.initialDepth;
    let indent = "  ".repeat(relativeDepth);
    const entryBeforeDiffArray = [];
    let skippedArray = [];
    let diffCount = 0;
    let isFirstNestedValue = true;
    const appendNestedValueDiff = (node, writeContext) => {
      let diff = writeDiff(node, {
        ...writeContext,
        textIndent: 0,
      });

      if (
        node.type === "indexed_value" ||
        node.type === "property_descriptor" ||
        node.type === "property" ||
        node.type === "prototype" ||
        node.type === "value_of_return_value"
      ) {
        if (node !== context.startNode) {
          diff += `\n`;
        }
      }
      if (isFirstNestedValue) {
        isFirstNestedValue = false;
        return diff;
      }
      return diff;
    };
    const next = createGetNextNestedValue(node, context, parentContext);
    let entry;
    while ((entry = next())) {
      if (context.resultType === "actual" && entry.node.diff.removed) {
        continue;
      }
      if (context.resultType === "expected" && entry.node.diff.added) {
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

        let skippedValues = 0;
        let skippedProps = 0;
        for (const skipped of skippedArray) {
          if (skipped.node.type === "indexed_value") {
            skippedValues++;
          }
          if (skipped.node.type === "property") {
            skippedProps++;
          }
        }
        if (skippedValues || skippedProps) {
          let aboveSummary = "";
          if (skippedValues) {
            aboveSummary += `${skippedValues} values`;
          }
          if (skippedProps) {
            if (aboveSummary) {
              aboveSummary += " ";
            }
            aboveSummary += `${skippedProps} props`;
          }
          insideDiff += `${indent}  `;
          const arrowSign = diffCount > 1 ? `↕` : `↑`;
          insideDiff += ANSI.color(
            `${arrowSign} ${aboveSummary} ${arrowSign}`,
            delimitersColor,
          );
          insideDiff += "\n";
          // TODO: textIndent must change
        }
        insideDiff += beforeDiff;
        skippedArray.length = 0;
      }
      insideDiff += appendNestedValueDiff(entry.node, entry.writeContext);
    }
    skippedArray.push(...entryBeforeDiffArray);
    // now display the values after
    const skippedCount = skippedArray.length;
    if (skippedCount) {
      // maxPropertyInsideDiff
      // I can display only the non modified props
      // and I can display only a subset
      // if there is any
      // is there a diff before?
      // if yes then it's maxValueAfterDiff
      // otherwise it's max after diff
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
        insideDiff += appendNestedValueDiff(
          nextEntry.node,
          nextEntry.writeContext,
        );
        // skippedArray.shift();
      }
      skippedArray = skippedArray.slice(index);
    }
    remaining_summary: {
      if (skippedArray.length === 0) {
        break remaining_summary;
      }
      const skippedPropCounters = {
        total: 0,
        removed: 0,
        added: 0,
        modified: 0,
      };
      const skippedValueCounters = {
        total: 0,
        removed: 0,
        added: 0,
        modified: 0,
      };
      for (const skipped of skippedArray) {
        const skippedCounters = {
          property: skippedPropCounters,
          indexed_value: skippedValueCounters,
        }[skipped.node.type];
        skippedCounters.total++;
        if (context.resultType === "actual") {
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
      if (skippedValueCounters.total) {
        belowSummary += ANSI.color(
          skippedValueCounters.total === 1
            ? `1 value`
            : `${skippedValueCounters.total} values`,
          delimitersColor,
        );
        const parts = [];
        if (skippedValueCounters.removed) {
          parts.push(
            ANSI.color(`${skippedValueCounters.removed} removed`, removedColor),
          );
        }
        if (skippedValueCounters.added) {
          parts.push(
            ANSI.color(`${skippedValueCounters.added} added`, addedColor),
          );
        }
        if (skippedValueCounters.modified) {
          parts.push(
            ANSI.color(
              `${skippedValueCounters.modified} modified`,
              context.resultType === "actual" ? unexpectedColor : expectedColor,
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
      if (skippedPropCounters.total) {
        belowSummary += ANSI.color(
          skippedPropCounters.total === 1
            ? `1 prop`
            : `${skippedPropCounters.total} props`,
          delimitersColor,
        );
        const parts = [];
        if (skippedPropCounters.removed) {
          parts.push(
            ANSI.color(`${skippedPropCounters.removed} removed`, removedColor),
          );
        }
        if (skippedPropCounters.added) {
          parts.push(
            ANSI.color(`${skippedPropCounters.added} added`, addedColor),
          );
        }
        if (skippedPropCounters.modified) {
          parts.push(
            ANSI.color(
              `${skippedPropCounters.modified} modified`,
              unexpectedColor,
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
      insideDiff += `${indent}  `;
      insideDiff += ANSI.color(`↓`, delimitersColor);
      insideDiff += " ";
      insideDiff += belowSummary;
      insideDiff += " ";
      insideDiff += ANSI.color(`↓`, delimitersColor);
      insideDiff += "\n";
    }

    if (insideDiff) {
      if (context.signs) {
        if (context.resultType === "actual") {
          if (context.added) {
            insideDiff += ANSI.color(addedSign, addedSignColor);
            indent = indent.slice(1);
          } else if (context.modified) {
            insideDiff += ANSI.color(unexpectedSign, unexpectedSignColor);
            indent = indent.slice(1);
          }
        } else if (context.removed) {
          insideDiff += ANSI.color(removedSign, removedSignColor);
          indent = indent.slice(1);
        }
      }
      if (valueInfo.isComposite) {
        insideDiff = `\n${insideDiff}`;
        insideDiff += indent;
      }
    }

    let afterPrefix = "";
    const shouldDisplayBrackets = prefix ? insideDiff.length > 0 : true;
    if (shouldDisplayBrackets) {
      const { openBracket, closeBracket } = getDelimiters(node, context);
      const bracketColor = getBracketColor(node, context);
      afterPrefix += ANSI.color(openBracket, bracketColor);
      afterPrefix += insideDiff;
      afterPrefix += ANSI.color(closeBracket, bracketColor);
    } else {
      afterPrefix += insideDiff;
    }
    if (prefix && afterPrefix) {
      expandedDiff += " ";
    }
    expandedDiff += afterPrefix;
    return expandedDiff;
  };
  const writeOverviewDiff = (node, context, parentContext) => {
    const prefixWithOverview = writePrefix(node, context, parentContext, {
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
      if (context.resultType === "actual" && entry.node.diff.removed) {
        continue;
      }
      if (context.resultType === "expected" && entry.node.diff.added) {
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
    const valueInfo = node[context.resultType];
    const valueCount = valueInfo.canHaveIndexedValues
      ? valueInfo.value.length
      : 0;
    const propertyNames = valueInfo.canHaveProps ? valueInfo.keys : [];
    const propertyCount = propertyNames.length;

    // let charIndex = 0;
    let valueIndex = 0;
    let valueOfReturnValueDisplayed = false;
    let prototypeDisplayed = false;
    let propIndex = 0;

    return () => {
      if (valueIndex < valueCount) {
        const indexedValueNode = node.indexedValues[valueIndex];
        valueIndex++;
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
    indexed_value: writeNestedValueDiff,
    property_descriptor: writeNestedValueDiff,
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
    if (context.resultType === "actual") {
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
    if (context.resultType === "actual") {
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
      if (context.resultType === "actual") {
        return unexpectedColor;
      }
      return expectedColor;
    }
    return sameColor;
  };
  const getBracketColor = (node, context) => {
    if (context.removed) {
      return removedColor;
    }
    if (context.added) {
      return addedColor;
    }
    if (context.modified) {
      if (
        node.actual.isComposite &&
        node.expected.isComposite &&
        node.actual.isArray === node.expected.isArray
      ) {
        // they use same brackets
        return sameColor;
      }
      if (node.actual.isString && node.expected.isString) {
        // they use same brackets
        return sameColor;
      }
      if (context.resultType === "actual") {
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
