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
      if (
        node.type === "as_string" &&
        node.parent.canDiffAsStrings &&
        node.canDiffUrlParts
      ) {
        return true;
      }
      if (node.actual.redundant && node.expected.redundant) {
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

        let compareAsStrings;
        if (ignoreDiff) {
          compareAsStrings = false;
        } else if (node.actual.isUrl && node.expected.isString) {
          compareAsStrings = true;
          onSelfDiff();
        } else if (node.expected.isUrl && node.actual.isString) {
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
          if (node.actual.reference !== node.expected.reference) {
            node.diff.reference = true;
            onSelfDiff();
          }
        }
        category: {
          if (ignoreCategoryDiff) {
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
            if (node.actual.isUrlString && node.expected.isUrlString) {
              // url part will contain the diffs
              node.diff.category = true;
            } else {
              node.diff.category = true;
              onSelfDiff();
              break category;
            }
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
        inside: {
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
            if (ignorePrototypeDiff) {
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
            node.canDiffPrototypes = canDiffPrototypes;
            const prototypeAreDifferentAndWellKnown =
              (node.actual.isArray && !node.expected.isArray) ||
              (!node.actual.isArray && node.expected.isArray) ||
              node.actual.isComposite !== node.expected.isComposite;
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
            if (ignoreValueOfReturnValueDiff) {
              break value_of_return_value;
            }
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
            if (
              actualValueOfReturnValue === node.actual.value &&
              expectedValueOfReturnValue === node.expected.value
            ) {
              valueOfReturnValueNode.actual.redundant = true;
              valueOfReturnValueNode.expected.redundant = true;
            }
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
          }
          as_string: {
            if (!node.actual.isUrl && !node.expected.isUrl) {
              break as_string;
            }
            const actualHasToString =
              node.actual.isComposite &&
              !actualStructureIsKnown &&
              "toString" in node.actual.value &&
              typeof node.actual.value.toString === "function";
            const expectedHasToString =
              node.expected.isComposite &&
              !expectedStructureIsKnown &&
              "toString" in node.expected.value &&
              typeof node.expected.value.toString === "function";
            if (!actualHasToString && !expectedHasToString) {
              break as_string;
            }
            let actualAsString;
            let expectedAsString;
            if (actualHasToString && !expectedHasToString) {
              actualAsString = node.actual.value.toString();
              expectedAsString = String(node.expected.value);
            } else if (!actualHasToString && expectedHasToString) {
              actualAsString = String(node.actual.value);
              expectedAsString = node.expected.value.toString();
            }
            let canDiffAsStrings =
              compareAsStrings &&
              typeof actualAsString === "string" &&
              typeof expectedAsString === "string";
            node.canDiffAsStrings = canDiffAsStrings;
            const asStringNode = node.appendAsString({
              actualAsString,
              expectedAsString,
            });
            visit(asStringNode, {
              ignoreDiff: ignoreDiff || !canDiffAsStrings,
            });
            appendCounters(
              node.diff.counters.inside,
              asStringNode.diff.counters.overall,
            );
          }

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
          url_parts: {
            if (node.type === "as_string") {
              break url_parts;
            }
            const visitActualUrlParts =
              node.actual.isUrl || node.actual.isUrlString;
            const visitExpectedUrlParts =
              node.expected.isUrl || node.expected.isUrlString;
            const canDiffUrlParts =
              visitActualUrlParts && visitExpectedUrlParts;
            node.canDiffUrlParts = canDiffUrlParts;
            if (!canDiffUrlParts) {
              break url_parts;
            }
            const actualUrlParts = node.actual.isUrl
              ? node.actual.value
              : new URL(node.actual.value);
            const expectedUrlParts = node.expected.isUrl
              ? node.expected.value
              : new URL(node.expected.value);
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
            const visitUrlPart = (name) => {
              let actualUrlPart = normalizeUrlPart(name, actualUrlParts[name]);
              let expectedUrlPart = normalizeUrlPart(
                name,
                expectedUrlParts[name],
              );
              const urlPartNode = node.appendUrlPart(name, {
                actualValue: actualUrlPart,
                expectedValue: expectedUrlPart,
              });
              if (!actualUrlPart && expectedUrlPart) {
                urlPartNode.diff.removed = true;
                if (!ignoreDiff) {
                  urlPartNode.diff.counters.self.removed++;
                  addNodeCausingDiff(urlPartNode);
                }
              }
              if (!expectedUrlPart && actualUrlPart) {
                urlPartNode.diff.added = true;
                if (!ignoreDiff) {
                  urlPartNode.diff.counters.self.added++;
                  addNodeCausingDiff(urlPartNode);
                }
              }
              visit(urlPartNode, {
                ignoreDiff:
                  ignoreDiff ||
                  urlPartNode.diff.removed ||
                  urlPartNode.diff.added,
              });
              appendCounters(
                node.diff.counters.inside,
                urlPartNode.diff.counters.overall,
              );
            };
            visitUrlPart("protocol");
            visitUrlPart("username");
            visitUrlPart("password");
            visitUrlPart("hostname");
            visitUrlPart("port");
            visitUrlPart("pathname");
            // for search params I'll have to think about it
            // for now we'll handle it as a string
            visitUrlPart("search");
            visitUrlPart("hash");
          }
          indexed_values: {
            const visitActualIndexedValues =
              node.actual.canHaveIndexedValues && !actualStructureIsKnown;
            const visitExpectedIndexedValues =
              node.expected.canHaveIndexedValues && !expectedStructureIsKnown;
            const canDiffIndexedValues =
              visitActualIndexedValues && visitExpectedIndexedValues;
            node.canDiffIndexedValues = canDiffIndexedValues;

            const actualValues = visitActualIndexedValues
              ? node.actual.isSet
                ? Array.from(node.actual.value.values())
                : node.actual.value
              : [];
            node.actual.values = actualValues;
            const expectedValues = visitExpectedIndexedValues
              ? node.expected.isSet
                ? Array.from(node.expected.value.values())
                : node.expected.value
              : [];
            node.expected.values = expectedValues;

            if (node.actual.isSet && node.expected.isSet) {
              let index = 0;
              const visitSetValue = (value, owner) => {
                const actualHasValue = node.actual.value.has(value);
                const expectedHasValue = node.expected.value.has(value);
                const indexedValueNode = node.appendIndexedValue(index, {
                  actualValue: actualHasValue ? value : null,
                  expectedValue: expectedHasValue ? value : null,
                });
                indexedValueNode.owner = owner;
                index++;
                if (!actualHasValue) {
                  indexedValueNode.diff.removed = true;
                  if (!ignoreDiff) {
                    indexedValueNode.diff.counters.self.removed++;
                    addNodeCausingDiff(indexedValueNode);
                  }
                }
                if (!expectedHasValue) {
                  indexedValueNode.diff.added = true;
                  if (!ignoreDiff) {
                    indexedValueNode.diff.counters.self.added++;
                    addNodeCausingDiff(indexedValueNode);
                  }
                }
                visit(indexedValueNode, { ignoreDiff: true });
                appendCounters(
                  node.diff.counters.inside,
                  indexedValueNode.diff.counters.overall,
                );
              };

              for (const actualValue of actualValues) {
                visitSetValue(actualValue, "actual");
              }
              for (const expectedValue of expectedValues) {
                visitSetValue(expectedValue, "expected");
              }
              break indexed_values;
            }

            const visitIndexedValue = (index) => {
              const actualHasOwn = visitActualIndexedValues
                ? Object.hasOwn(actualValues, index)
                : false;
              const expectedHasOwn = visitExpectedIndexedValues
                ? Object.hasOwn(expectedValues, index)
                : false;
              const actualValue = actualHasOwn
                ? actualValues[index]
                : visitActualIndexedValues && index < actualValues.length
                  ? ARRAY_EMPTY_VALUE
                  : undefined;
              const expectedValue = expectedHasOwn
                ? expectedValues[index]
                : visitExpectedIndexedValues && index < expectedValues.length
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
              while (index < expectedValues.length) {
                visitIndexedValue(index);
                index++;
              }
            }
            if (visitActualIndexedValues) {
              let index = expectedValues.length;
              while (index < actualValues.length) {
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
      maxDepth,
      maxDiffPerObject,
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
      maxDepth,
      maxDiffPerObject,
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
        node.appendAsString = ({ actualAsString, expectedAsString }) => {
          const asStringNode = createComparisonNode({
            type: "as_string",
            actualValue: actualAsString,
            expectedValue: expectedAsString,
            parent: node,
          });
          node.asString = asStringNode;
          node.diff.asString = asStringNode.diff;
          return asStringNode;
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
      if (
        (node.actual.isUrl || node.actual.isUrlString) &&
        (node.expected.isUrl || node.expected.isUrlString)
      ) {
        node.urlParts = {};
        node.appendUrlPart = (name, { actualValue, expectedValue }) => {
          const urlPartNode = createComparisonNode({
            type: "url_part",
            actualValue,
            expectedValue,
            parent: node,
          });
          urlPartNode.name = name;
          node.urlParts[name] = urlPartNode;
          return urlPartNode;
        };
      }
      return node;
    };

    const createValueInfo = (value, { name, type, parent }) => {
      let composite;
      let wellKnownId;
      let subtype;
      let isArray;
      let isSet = false;
      let isString = false;
      let isStringObject = false;
      let isUrl = false;
      let isUrlString = false;

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
        const parentValueInfo = parent[name];
        // we display in constructor if parent subtype is not Object nor Array
        // (if there is a constructor displayed)
        const parentSubtype = parentValueInfo.subtype;
        if (parentSubtype !== "Object" && parentSubtype !== "Array") {
          inConstructor = true;
        }
      }
      if (type === "as_string") {
        const parentValueInfo = parent[name];
        if (parentValueInfo.isUrl || !composite) {
          inConstructor = true;
        }
      }

      let depth;
      if (parent) {
        if (type === "property") {
          depth = parent[name].depth;
        } else if (type === "value_of_return_value" && inConstructor) {
          depth = parent[name].depth;
        } else if (type === "to_string_return_value" && inConstructor) {
          depth = parent[name].depth;
        } else if (type === "url_part") {
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
      };
    };

    const root = createComparisonNode({
      type: "value",
      actualValue,
      expectedValue,
    });

    return { root };
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
    const valueInfo = node[context.resultType];
    const relativeDepth = valueInfo.depth + context.initialDepth;
    const valueContext = {
      ...context,
    };
    if (!context.modified) {
      const hasUrlParts = valueInfo.isUrlString || valueInfo.isUrl;
      if (hasUrlParts && node.canDiffUrlParts) {
        // the urls parts will display the diff
      } else if (node.asString && node.canDiffAsStrings) {
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

    if (valueInfo.wellKnownId) {
      const valueColor = getValueColor(valueContext);
      return ANSI.color(valueInfo.wellKnownId, valueColor);
    }
    if (valueInfo.isUrlString && node.canDiffUrlParts) {
      return writeCompositeDiff(node, valueContext, context);
    }
    if (valueInfo.isPrimitive) {
      if (node.asString && node.canDiffAsStrings) {
        return writeLinesDiff(node.asString, valueContext, context);
      }
      const value = valueInfo.value;
      if (valueInfo.canHaveLines) {
        const string = value;
        if (valueContext.collapsed) {
          if (!node.quote && node.type !== "url_part") {
            const quote =
              context.quote === "auto" ? pickBestQuote(string) : context.quote;
            node.quote = quote; // ensure the quote in expected is "forced" to the one in actual
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
          if (node.quote) {
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
                context.resultType === "actual"
                  ? unexpectedColor
                  : expectedColor;
            } else if (
              nodeForQuotes.actual.isComposite ===
              nodeForQuotes.expected.isComposite
            ) {
              quoteColor = sameColor;
            } else {
              quoteColor =
                context.resultType === "actual"
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
  const displayedIdMap = new Map();
  const writeCompositeDiff = (node, context, parentContext) => {
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
    const valueInfo = node[context.resultType];
    const delimitersColor = getDelimitersColor(context);

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
        if (referenceFromOther[parentContext.resultType].redundant) {
          continue;
        }
        referenceFromOtherDisplayed = referenceFromOther;
        break;
      }
      if (referenceFromOtherDisplayed) {
        compositeDiff += ANSI.color(
          `<ref #${getDisplayedId(
            referenceFromOtherDisplayed[parentContext.resultType].reference.id,
          )}>`,
          delimitersColor,
        );
        compositeDiff += " ";
      }
    }

    inside: {
      if (context.collapsed) {
        if (context.insideOverview) {
          const overviewDiff = writeOverviewDiff(node, context, parentContext);
          compositeDiff += overviewDiff;
        } else {
          const collapsedDiff = writeCollapsedDiff(
            node,
            context,
            parentContext,
          );
          compositeDiff += collapsedDiff;
        }
      } else {
        const expandedDiff = writeExpandedDiff(node, context, parentContext);
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
    if (node.type === "as_string" && node[context.resultType].inConstructor) {
      return writeValueDiff(node, context);
    }
    if (
      node.type === "property_descriptor" &&
      isDefaultDescriptor(node.descriptor, node[context.resultType].value)
    ) {
      return "";
    }

    const nestedValueContext = getNestedValueContext(node, context);
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
        node.type === "value_of_return_value" ||
        node.type === "as_string");
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
            : node.type === "to_string_return_value"
              ? "toString()"
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
    let endSeparator;
    if (valueInfo.canHaveLines && node.lines.length > 1) {
      // when using
      // foo: 1| line 1
      //      2| line 2
      //      3| line 3
      // the "," separator is removed because it's not correctly separated from the multiline
      // and it becomes hard to know if "," is part of the string or not
      endSeparator = "";
    } else if (useIndent && node !== nestedValueContext.startNode) {
      endSeparator = ",";
    } else {
      endSeparator = "";
    }
    if (displayValue) {
      nestedValueContext.textIndent += stringWidth(nestedValueDiff);
      nestedValueContext.maxColumns -= endSeparator.length;
      if (nestedValueContext.modified) {
        nestedValueContext.maxDepth = Math.min(
          valueInfo.depth + nestedValueContext.maxDepthInsideDiff,
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
        let overviewContent = valueInfo.isSet
          ? valueInfo.setValues.length
          : valueInfo.keys.length;
        if (context.added) {
          insideConstructor = ANSI.color(overviewContent, addedColor);
        } else if (context.removed) {
          insideConstructor = ANSI.color(overviewContent, removedColor);
        } else if (node.actual.isSet && node.expected.isSet) {
          if (context.resultType === "actual") {
            const added = node.actual.setValues.some(
              (setValueNode) => setValueNode.diff.added,
            );
            insideConstructor = ANSI.color(
              overviewContent,
              added ? addedColor : sameColor,
            );
          } else {
            const removed = node.expected.setValues.some(
              (setValueNode) => setValueNode.diff.removed,
            );
            insideConstructor = ANSI.color(
              overviewContent,
              removed ? removedColor : sameColor,
            );
          }
        } else if (node.actual.isSet !== node.expected.isSet) {
          insideConstructor = ANSI.color(
            overviewContent,
            context.resultType === "actual" ? unexpectedColor : expectedColor,
          );
        } else if (
          node.actual.isComposite &&
          node.expected.isComposite &&
          node.actual.keys.length === node.expected.keys.length
        ) {
          insideConstructor = ANSI.color(overviewContent, sameColor);
        } else {
          insideConstructor = ANSI.color(
            overviewContent,
            context.resultType === "actual" ? unexpectedColor : expectedColor,
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
      if (!node.quote && node.type !== "url_part") {
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
          context.resultType === "actual" ? unexpectedColor : expectedColor;
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
            context.resultType === "actual" ? unexpectedColor : expectedColor;
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
            context.resultType === "actual" ? unexpectedColor : expectedColor;
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
          context.resultType === "actual" ? unexpectedColor : expectedColor;
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
          context.resultType === "actual" ? unexpectedColor : expectedColor;
      } else {
        hashSeparatorColor = sameColor;
      }
      urlDiff += ANSI.color("#", hashSeparatorColor);
      urlDiff += hashDiff;
    }
    urlDiff += ANSI.color(`"`, bracketColor);
    return urlDiff;
  };

  const writeExpandedDiff = (node, context, parentContext) => {
    const valueInfo = node[context.resultType];
    if (
      valueInfo.isString &&
      !valueInfo.isUrlString &&
      valueInfo.canHaveLines
    ) {
      return writeLinesDiff(node, context, parentContext);
    }
    if (node.type === "as_string") {
      return writeLinesDiff(node, context, parentContext);
    }

    const delimitersColor = getDelimitersColor(context);
    const relativeDepth = valueInfo.depth + context.initialDepth;
    let indent = "  ".repeat(relativeDepth);
    let diffCount = 0;

    const appendNestedValueDiff = (node, writeContext) => {
      let diff = writeDiff(node, {
        ...writeContext,
        textIndent: 0,
      });
      if (node !== context.startNode) {
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
        if (context.resultType === "actual" && entry.node.diff.removed) {
          continue;
        }
        if (context.resultType === "expected" && entry.node.diff.added) {
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
                context.resultType === "actual"
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
        if (valueInfo.isComposite) {
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
    if (!valueInfo.isUrlString) {
      prefix = writePrefix(node, context, parentContext);
      insideDiff += prefix;
    }

    if (valueInfo.isUrl || valueInfo.isUrlString) {
      let urlDiff;
      if (node.canDiffUrlParts) {
        urlDiff = writeUrlDiff(node, context, parentContext);
      } else {
        urlDiff = writeDiff(node.asString, context, parentContext);
      }

      if (valueInfo.isUrl) {
        let parenthesisColor;
        if (node.actual.isComposite === node.expected.isComposite) {
          parenthesisColor = sameColor;
        } else {
          parenthesisColor =
            context.resultType === "actual" ? unexpectedColor : expectedColor;
        }
        insideDiff += ANSI.color("(", parenthesisColor);
        insideDiff += urlDiff;
        insideDiff += ANSI.color(")", parenthesisColor);
      } else {
        insideDiff += urlDiff;
      }
    }

    if (valueInfo.canHaveIndexedValues) {
      const indexedValueDiff = writeGroupDiff(
        createGetIndexedValues(node, context, parentContext),
        {
          valueLabel: "value",
          forceBracket: true,
          openBracket: "[",
          closeBracket: "]",
        },
      );
      if (valueInfo.isSet) {
        insideDiff += ANSI.color("(", delimitersColor);
      }
      if (indexedValueDiff) {
        insideDiff += indexedValueDiff;
      }
      if (valueInfo.isSet) {
        insideDiff += ANSI.color(")", delimitersColor);
      }
    }
    if (!valueInfo.isUrlString) {
      const propsDiff = writeGroupDiff(
        createGetProps(node, context, parentContext),
        {
          valueLabel: "prop",
          forceBracket: !valueInfo.canHaveIndexedValues && prefix.length === 0,
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
      if (node.actual.isComposite && node.expected.isComposite) {
        const actualOpenBracket =
          node.actual.isArray || node.actual.isSet ? "[" : "{";
        const expectedOpenBracket =
          node.expected.isArray || node.expected.isSet ? "[" : "{";
        if (actualOpenBracket === expectedOpenBracket) {
          // they use same brackets
          return sameColor;
        }
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
