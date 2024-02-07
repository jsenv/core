import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isAssertionError, createAssertionError } from "./assertion_error.js";

const removedSign = UNICODE.FAILURE_RAW;
const addedSign = UNICODE.FAILURE_RAW;
const unexpectedSign = UNICODE.FAILURE_RAW;
const colorForSame = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectedColor = ANSI.RED;
const expectedColor = ANSI.GREEN;
const unexpectedSignColor = ANSI.GREY;
const removedSignColor = ANSI.GREY;
const addedSignColor = ANSI.GREY;
const ARRAY_EMPTY_VALUE = { array_empty_value: true }; // Symbol.for('array_empty_value') ?

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
      maxDepth: maxDepthDefault = 5,
      maxColumns: maxColumnsDefault = 100,
      maxDiffPerObject = 5,
      maxValueAroundDiff = 2,
      maxValueInsideDiff = 4,
      maxDepthInsideDiff = 1,
    } = firstArg;
    const maxValueBeforeDiff = maxValueAroundDiff;
    const maxValueAfterDiff = maxValueAroundDiff;

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
    const addNodeCausingDiff = (node) => {
      causeCounters.total++;
      causeSet.add(node);
    };
    const onNodeDisplayed = (node) => {
      if (causeSet.has(node)) {
        causeSet.delete(node);
        causeCounters.displayed++;
      }
      if (node.type === "property") {
        for (const descriptor of Object.keys(node.descriptors)) {
          onNodeDisplayed(node.descriptors[descriptor]);
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

    const visit = (node, { ignoreDiff } = {}) => {
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
          const descriptorNode = node.appendPropertyDescriptor(descriptorName, {
            actualValue: actualDescriptorValue,
            expectedValue: expectedDescriptorValue,
          });
          visit(descriptorNode, { ignoreDiff });
          if (!ignoreDiff) {
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
          }
        };
        visitPropertyDescriptor("value");
        visitPropertyDescriptor("enumerable");
        visitPropertyDescriptor("writable");
        visitPropertyDescriptor("configurable");
        visitPropertyDescriptor("set");
        visitPropertyDescriptor("get");
      } else {
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
          const actualIsArray = node.actual.isArray;
          const expectedIsArray = node.expected.isArray;
          if (actualIsArray !== expectedIsArray) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
        }
        prototype: {
          if (node.actual.isComposite || node.expected.isComposite) {
            const actualCanHavePrototype = node.actual.isComposite;
            const expectedCanHavePrototype = node.expected.isComposite;
            const canDiffPrototypes =
              actualCanHavePrototype && expectedCanHavePrototype;
            const prototypeAreDifferentAndWellKnown =
              (node.actual.isArray && !node.expected.isArray) ||
              (!node.actual.isArray && node.expected.isArray);
            node.canDiffPrototypes = canDiffPrototypes;
            node.prototypeAreDifferentAndWellKnown =
              prototypeAreDifferentAndWellKnown;

            const actualPrototype = node.actual.isComposite
              ? Object.getPrototypeOf(node.actual.value)
              : null;
            const expectedPrototype = node.expected.isComposite
              ? Object.getPrototypeOf(node.expected.value)
              : null;
            const prototypeNode = node.appendPrototype({
              actualPrototype,
              expectedPrototype,
            });
            visit(prototypeNode, {
              ignoreDiff:
                ignoreDiff ||
                !canDiffPrototypes ||
                node.diff.category ||
                prototypeAreDifferentAndWellKnown,
            });
            if (prototypeNode.diff.counters.overall.any) {
              appendCounters(
                node.diff.counters.self,
                prototypeNode.diff.counters.overall,
              );
            }
          }
        }
        inside: {
          indexed_values: {
            const actualCanHaveIndexedValues = node.actual.canHaveIndexedValues;
            const expectedCanHaveIndexedValues =
              node.expected.canHaveIndexedValues;
            const canDiffIndexedValues =
              actualCanHaveIndexedValues && expectedCanHaveIndexedValues;
            node.canDiffIndexedValues = canDiffIndexedValues;

            const visitIndexedValue = (index) => {
              const actualHasOwn = actualCanHaveIndexedValues
                ? Object.hasOwn(node.actual.value, index)
                : false;
              const expectedHasOwn = expectedCanHaveIndexedValues
                ? Object.hasOwn(node.expected.value, index)
                : false;
              const actualValue = actualHasOwn
                ? node.actual.value[index]
                : actualCanHaveIndexedValues && index < node.actual.value.length
                  ? ARRAY_EMPTY_VALUE
                  : undefined;
              const expectedValue = expectedHasOwn
                ? node.expected.value[index]
                : expectedCanHaveIndexedValues &&
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
                actualCanHaveIndexedValues
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
                expectedCanHaveIndexedValues
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
            if (
              expectedCanHaveIndexedValues &&
              !node.expected.reference &&
              !node.expected.wellKnownId
            ) {
              let index = 0;
              while (index < node.expected.value.length) {
                visitIndexedValue(index);
                index++;
              }
            }
            if (
              actualCanHaveIndexedValues &&
              !node.actual.reference &&
              !node.actual.wellKnownId
            ) {
              let index = 0;
              while (index < node.actual.value.length) {
                if (!node.indexedValues[index]) {
                  visitIndexedValue(index);
                }
                index++;
              }
            }
          }
          properties: {
            const actualCanHaveProps = node.actual.canHaveProps;
            const expectedCanHaveProps = node.expected.canHaveProps;
            const canDiffProps = actualCanHaveProps && expectedCanHaveProps;
            node.canDiffProps = canDiffProps;

            // here we want to traverse before and after but if they are not composite
            // we'll consider everything as removed or added, depending the scenario
            const visitProperty = (property) => {
              const actualPropertyDescriptor = actualCanHaveProps
                ? Object.getOwnPropertyDescriptor(node.actual.value, property)
                : undefined;
              const expectedPropertyDescriptor = expectedCanHaveProps
                ? Object.getOwnPropertyDescriptor(node.expected.value, property)
                : undefined;
              const propertyNode = node.appendProperty(property, {
                actualPropertyDescriptor,
                expectedPropertyDescriptor,
              });

              if (
                !actualPropertyDescriptor &&
                expectedPropertyDescriptor &&
                actualCanHaveProps
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
                expectedCanHaveProps
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

            if (
              expectedCanHaveProps &&
              // node.after.value is a reference: was already traversed
              // - prevent infinite recursion for circular structure
              // - prevent traversing a structure already known
              !node.expected.reference &&
              !node.expected.wellKnownId
            ) {
              const expectedKeys = [];
              const expectedPropertyNames = Object.getOwnPropertyNames(
                node.expected.value,
              );
              for (const expectedPropertyName of expectedPropertyNames) {
                if (node.expected.isArray) {
                  if (
                    expectedPropertyName === "length" ||
                    isArrayIndex(expectedPropertyName)
                  ) {
                    continue;
                  }
                }
                expectedKeys.push(expectedPropertyName);
                visitProperty(expectedPropertyName);
              }
              node.expected.keys = expectedKeys;
            }
            if (
              actualCanHaveProps &&
              // node.after.value is a reference: was already traversed
              // - prevent infinite recursion for circular structure
              // - prevent traversing a structure already known
              !node.actual.reference &&
              !node.actual.wellKnownId
            ) {
              const actualKeys = [];
              const actualPropertyNames = Object.getOwnPropertyNames(
                node.actual.value,
              );
              for (const actualPropertyName of actualPropertyNames) {
                if (node.actual.isArray) {
                  if (
                    actualPropertyName === "length" ||
                    isArrayIndex(actualPropertyName)
                  ) {
                    continue;
                  }
                }
                actualKeys.push(actualPropertyName);
                if (!node.properties[actualPropertyName]) {
                  visitProperty(actualPropertyName);
                }
              }
              node.actual.keys = actualKeys;
            }
          }
        }
      }

      settleCounters(node);
    };
    visit(rootComparison);
    if (causeSet.size === 0) {
      return;
    }

    let signs = false;
    let refId = 1;
    let startNode = rootComparison;
    const [firstNodeCausingDiff] = causeSet;
    if (
      firstNodeCausingDiff.depth >= maxDepthDefault &&
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
      let startNodeDepth = firstNodeCausingDiff.depth - maxDepthDefault;
      let valuePath = createValuePath();
      for (const node of nodesFromRootToTarget) {
        if (
          startNode === rootComparison &&
          node.type === "property_descriptor" &&
          node.depth > startNodeDepth
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
      }
    }

    const getContextForNestedValue = (node, context) => {
      let { resultType, removed, added, modified } = context;
      if (node.type === "indexed_value") {
        if (node.diff.removed) {
          removed = true;
        }
        if (node.diff.added) {
          added = true;
        }
      }
      if (node.type === "property_descriptor") {
        if (node.parent.diff.removed) {
          removed = true;
        }
        if (node.parent.diff.added) {
          added = true;
        }
        if (isDefaultDescriptor(node.descriptor, node[resultType].value)) {
          return null;
        }
      }
      return { ...context, removed, added, modified };
    };

    const writeNestedValueDiff = (
      node,
      context,
      { property, propertyPrefix },
    ) => {
      context = getContextForNestedValue(node, context);
      if (!context) {
        return "";
      }
      let { resultType, removed, added, modified, maxDepth, initialDepth } =
        context;
      let nestedValueDiff = "";
      const relativeDepth = node.depth + initialDepth;
      let indent = `  `.repeat(relativeDepth);
      let keyColor;
      let delimitersColor;
      let displayValue = true;

      if (resultType === "actual") {
        if (added) {
          keyColor = delimitersColor = addedColor;
        } else if (modified) {
          keyColor = delimitersColor = unexpectedColor;
        } else {
          keyColor = delimitersColor = colorForSame;
        }
      } else if (removed) {
        keyColor = delimitersColor = removedColor;
      } else if (modified) {
        keyColor = delimitersColor = expectedColor;
      } else {
        keyColor = delimitersColor = colorForSame;
      }

      if (signs && !context.collapsed) {
        if (removed) {
          if (resultType === "expected") {
            nestedValueDiff += ANSI.color(removedSign, removedSignColor);
            indent = indent.slice(1);
          }
        } else if (added) {
          if (resultType === "actual") {
            nestedValueDiff += ANSI.color(addedSign, addedSignColor);
            indent = indent.slice(1);
          }
        } else if (modified) {
          if (resultType === "actual") {
            nestedValueDiff += ANSI.color(unexpectedSign, unexpectedSignColor);
            indent = indent.slice(1);
          }
        }
      }

      if (!context.collapsed) {
        nestedValueDiff += indent;
      }
      if (property) {
        if (propertyPrefix) {
          nestedValueDiff += ANSI.color(propertyPrefix, keyColor);
          nestedValueDiff += " ";
        }
        const propertyKeyFormatted = humanizePropertyKey(property);
        nestedValueDiff += ANSI.color(propertyKeyFormatted, keyColor);
        if (displayValue) {
          nestedValueDiff += ANSI.color(":", keyColor);
          nestedValueDiff += " ";
        }
      }
      if (displayValue) {
        const valueMaxColumns =
          maxColumnsDefault - stringWidth(nestedValueDiff) - ",".length;
        if (modified) {
          maxDepth = Math.min(node.depth + maxDepthInsideDiff, maxDepth);
        }
        const valueDiff = writeValueDiff(node, {
          ...context,
          maxDepth,
          maxColumns: valueMaxColumns,
        });
        nestedValueDiff += valueDiff;
      }
      if (!context.collapsed && node !== startNode) {
        nestedValueDiff += ANSI.color(",", delimitersColor);
        nestedValueDiff += "\n";
      }
      return nestedValueDiff;
    };
    const writeIndexedValueDiff = (node, context) => {
      return writeNestedValueDiff(node, context, {});
    };
    const writePrototypeDiff = (node, context) => {
      return writeNestedValueDiff(node, context, {
        property: node === startNode ? null : "__proto__", // "[[Prototype]]"?
      });
    };
    const writePropertyDescriptorDiff = (node, context) => {
      return writeNestedValueDiff(node, context, {
        property: node === startNode ? null : node.property,
        propertyPrefix: node.descriptor === "value" ? null : node.descriptor,
      });
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
        propertyDiff += writeDiff(descriptorNode, {
          ...context,
        });
      }
      return propertyDiff;
    };
    const writeValueDiff = (node, context) => {
      let {
        resultType,
        removed,
        added,
        modified,
        maxColumns,
        maxDepth,
        collapsed,
        initialDepth,
      } = context;
      if (!modified && node.diff.counters.self.any > 0) {
        modified = true;
      }

      const valueInfo = node[resultType];
      let valueColor;
      let delimitersColor;
      if (resultType === "actual") {
        if (added) {
          delimitersColor = valueColor = addedColor;
        } else if (modified) {
          delimitersColor = valueColor = unexpectedColor;
        } else {
          delimitersColor = valueColor = colorForSame;
        }
      } else if (removed) {
        delimitersColor = valueColor = removedColor;
      } else if (modified) {
        delimitersColor = valueColor = expectedColor;
      } else {
        delimitersColor = valueColor = colorForSame;
      }

      if (valueInfo.wellKnownId) {
        return ANSI.color(valueInfo.wellKnownId, valueColor);
      }

      // primitive
      if (valueInfo.isPrimitive) {
        const value = valueInfo.value;
        let valueDiff =
          value === undefined
            ? "undefined"
            : value === null
              ? "null"
              : JSON.stringify(value);
        if (valueDiff.length > maxColumns) {
          valueDiff = valueDiff.slice(0, maxColumns);
          valueDiff += "…";
        }
        return ANSI.color(valueDiff, valueColor);
      }

      if (context.collapsed && node.type === "property_descriptor") {
        if (node.descriptor === "get") {
          if (node.parent.descriptors.set[resultType].value) {
            return ANSI.color("[get/set]", valueColor);
          }
          return ANSI.color("[get]", valueColor);
        }
        if (node.descriptor === "set") {
          if (node.parent.descriptors.get[resultType].value) {
            return ANSI.color("[get/set]", valueColor);
          }
          return ANSI.color("[set]", valueColor);
        }
      }

      // composite
      let compositeDiff = "";
      if (valueInfo.reference) {
        compositeDiff += ANSI.color(
          `<ref #${valueInfo.referenceId}>`,
          delimitersColor,
        );
      }
      if (valueInfo.referenceFromOthersSet.size) {
        compositeDiff += ANSI.color(`<ref #${refId}>`, delimitersColor);
        compositeDiff += " ";
      }
      const relativeDepth = node.depth + initialDepth;
      const insideOverview = collapsed !== true;
      if (!collapsed) {
        collapsed =
          relativeDepth >= maxDepth || node.diff.counters.overall.any === 0;
      }

      const writeInsideDiff = ({ next }) => {
        let insideDiff = "";
        let indent = "  ".repeat(relativeDepth);
        const skippedArray = [];
        let diffCount = 0;
        let nextEntry;
        let isFirstNestedValue = true;
        const appendNestedValueDiff = (diff) => {
          if (context.collapsed) {
            return diff;
          }
          if (isFirstNestedValue) {
            isFirstNestedValue = false;

            return diff;
          }
          // insideDiff += ANSI.color(",", delimitersColor);
          // insideDiff += "\n";
          return diff;
        };

        while ((nextEntry = next())) {
          const { node: nodeInsideThisOne, write } = nextEntry;
          if (resultType === "actual" && nodeInsideThisOne.diff.removed) {
            continue;
          }
          if (resultType === "expected" && nodeInsideThisOne.diff.added) {
            continue;
          }

          if (nodeInsideThisOne.diff.counters.overall.any) {
            diffCount++;
            // too many diff
            if (diffCount > maxDiffPerObject) {
              skippedArray.push(nextEntry);
              continue;
            }
            // first write nested value (prop, value) eventually skipped
            const skippedCount = skippedArray.length;
            if (skippedCount) {
              let beforeDiff = "";
              let from = skippedArray.length - maxValueBeforeDiff;
              let to = skippedArray.length - 1;
              let index = from;
              while (index !== to) {
                const previousToDisplay = skippedArray[skippedArray.length - 1];
                if (!previousToDisplay) {
                  break;
                }
                skippedArray.pop();
                beforeDiff += appendNestedValueDiff(previousToDisplay.write());
                index++;
              }
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
              }
              insideDiff += beforeDiff;
              skippedArray.length = 0;
            }
            insideDiff += appendNestedValueDiff(write());
            continue;
          }
          skippedArray.push(nextEntry);
          // does not have a diff
          // will either be written when we encounter a diff
          // or be skipped
        }
        // now display the values below
        const skippedCount = skippedArray.length;
        if (skippedCount) {
          // maxPropertyInsideDiff
          // I can display only the non modified props
          // and I can display only a subset
          // if there is any
          // is there a diff before?
          // if yes then it's maxValueAfterDiff
          // otherwise it's maxper diff
          const maxValueAfter = modified
            ? maxValueInsideDiff - 1
            : maxValueAfterDiff - 1;
          let displayedAfter = 0;
          while (displayedAfter !== maxValueAfter) {
            const nextToDisplay = skippedArray[0];
            if (!nextToDisplay) {
              break;
            }
            if (nextToDisplay.node.diff.counters.self.any) {
              break;
            }
            insideDiff += appendNestedValueDiff(nextToDisplay.write());
            skippedArray.shift();
            displayedAfter++;
          }
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
            if (skipped.node.type === "property") {
              skippedPropCounters.total++;
              if (resultType === "actual") {
                if (skipped.node.diff.added) {
                  onNodeDisplayed(skipped.node);
                  skippedPropCounters.added++;
                  continue;
                }
                if (skipped.node.diff.counters.overall.any) {
                  onNodeDisplayed(skipped.node);
                  skippedPropCounters.modified++;
                  continue;
                }
                continue;
              }
              if (skipped.node.diff.removed) {
                onNodeDisplayed(skipped.node);
                skippedPropCounters.removed++;
              }
              continue;
            }
            if (skipped.node.type === "indexed_value") {
              skippedValueCounters.total++;
              if (resultType === "actual") {
                if (skipped.node.diff.added) {
                  onNodeDisplayed(skipped.node);
                  skippedValueCounters.added++;
                  continue;
                }
                if (skipped.node.diff.counters.overall.any) {
                  onNodeDisplayed(skipped.node);
                  skippedValueCounters.modified++;
                  continue;
                }
                continue;
              }
              if (skipped.node.diff.removed) {
                onNodeDisplayed(skipped.node);
                skippedValueCounters.removed++;
              }
              continue;
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
                ANSI.color(
                  `${skippedValueCounters.removed} removed`,
                  removedColor,
                ),
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
                ANSI.color(
                  `${skippedPropCounters.removed} removed`,
                  removedColor,
                ),
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
        if (insideDiff === "") {
          return "";
        }
        if (signs) {
          if (resultType === "actual") {
            if (added) {
              insideDiff += ANSI.color(addedSign, addedSignColor);
              indent = indent.slice(1);
            } else if (modified) {
              insideDiff += ANSI.color(unexpectedSign, unexpectedSignColor);
              indent = indent.slice(1);
            }
          } else if (removed) {
            insideDiff += ANSI.color(removedSign, removedSignColor);
            indent = indent.slice(1);
          }
        }
        insideDiff = `\n${insideDiff}`;
        // if (!valueInfo.isArray) {
        //   insideDiff += ANSI.color(",", delimitersColor);
        // }
        // insideDiff += "\n";
        insideDiff += indent;
        return insideDiff;
      };
      const writeOverview = ({ next }) => {
        const prefix = valueInfo.isArray
          ? `Array(${valueInfo.value.length})`
          : `Object(${valueInfo.keys.length})`;
        const openBracket = valueInfo.isArray ? "[" : "{ ";
        const closeBracket = valueInfo.isArray ? "]" : " }";
        const estimatedCollapsedBoilerplate = `${prefix} ${openBracket}, ...${closeBracket}`;
        const estimatedCollapsedBoilerplateWidth =
          estimatedCollapsedBoilerplate.length;
        const remainingWidth = maxColumns - estimatedCollapsedBoilerplateWidth;

        let insideOverview = "";
        let isFirst = true;
        let width = 0;
        let nextEntry;
        while ((nextEntry = next())) {
          const { node: nodeInsideThisOne, write } = nextEntry;
          if (resultType === "actual" && nodeInsideThisOne.diff.removed) {
            continue;
          }
          if (resultType === "expected" && nodeInsideThisOne.diff.added) {
            continue;
          }

          let valueOverview = "";
          valueOverview += write();
          const valueWidth = stringWidth(valueOverview);
          if (width + valueWidth > remainingWidth) {
            let overview = "";
            overview += ANSI.color(prefix, delimitersColor);
            overview += " ";
            overview += ANSI.color(openBracket, delimitersColor);
            if (insideOverview) {
              overview += insideOverview;
              overview += ANSI.color(",", delimitersColor);
              overview += " ";
            }
            overview += ANSI.color(`...`, valueColor);
            overview += ANSI.color(closeBracket, delimitersColor);
            return overview;
          }
          width += valueWidth;
          if (isFirst) {
            isFirst = false;
            insideOverview += valueOverview;
          } else {
            insideOverview += ANSI.color(",", delimitersColor);
            insideOverview += " ";
            width += ", ".length;
            insideOverview += valueOverview;
          }
        }

        let overview = "";
        overview += valueInfo.isArray
          ? ANSI.color("[", delimitersColor)
          : ANSI.color("{", delimitersColor);
        if (insideOverview) {
          overview += valueInfo.isArray ? "" : " ";
          overview += insideOverview;
          overview += valueInfo.isArray ? "" : " ";
        }
        overview += valueInfo.isArray
          ? ANSI.color("]", delimitersColor)
          : ANSI.color("}", delimitersColor);
        return overview;
      };

      const createGetNextNestedValue = () => {
        const length = valueInfo.canHaveIndexedValues
          ? valueInfo.value.length
          : 0;
        const propertyNames = valueInfo.canHaveProps ? valueInfo.keys : [];
        const propertyCount = propertyNames.length;

        let valueIndex = 0;
        let prototypeDisplayed = false;
        let propIndex = 0;

        return () => {
          if (valueIndex < length) {
            const indexedValueNode = node.indexedValues[valueIndex];
            valueIndex++;
            return {
              node: indexedValueNode,
              write: () => {
                return writeDiff(indexedValueNode, {
                  ...context,
                  modified: node.canDiffIndexedValues
                    ? context.modified
                    : modified,
                  collapsed,
                });
              },
            };
          }
          if (
            !prototypeDisplayed &&
            node.diff.prototype.counters.overall.any &&
            !node.prototypeAreDifferentAndWellKnown
          ) {
            prototypeDisplayed = true;
            return {
              node: node.prototype,
              write: () => {
                return writeDiff(node.prototype, {
                  ...context,
                  modified: node.canDiffPrototypes
                    ? context.modified
                    : modified,
                  collapsed,
                });
              },
            };
          }
          if (propIndex < propertyCount) {
            const propertyNode = node.properties[propertyNames[propIndex]];
            propIndex++;
            return {
              node: propertyNode,
              write: () => {
                return writeDiff(propertyNode, {
                  ...context,
                  modified: node.canDiffProps ? context.modified : modified,
                  collapsed,
                });
              },
            };
          }
          return null;
        };
      };

      inside: {
        if (collapsed && insideOverview) {
          const overview = writeOverview({
            next: createGetNextNestedValue(),
          });
          compositeDiff += overview;
          break inside;
        }
        if (collapsed) {
          if (valueInfo.isArray) {
            const length = valueInfo.value.length;
            compositeDiff += ANSI.color("Array(", delimitersColor);
            compositeDiff += ANSI.color(`${length}`, delimitersColor);
            compositeDiff += ANSI.color(")", delimitersColor);
            break inside;
          }
          const propertyNames = valueInfo.keys;
          const propertyCount = propertyNames.length;
          compositeDiff += ANSI.color("Object(", delimitersColor);
          compositeDiff += ANSI.color(`${propertyCount}`, delimitersColor);
          compositeDiff += ANSI.color(")", delimitersColor);
          break inside;
        }
        compositeDiff += valueInfo.isArray
          ? ANSI.color("[", delimitersColor)
          : ANSI.color("{", delimitersColor);
        let insideDiff = writeInsideDiff({
          next: createGetNextNestedValue(),
        });
        compositeDiff += insideDiff;
        compositeDiff += valueInfo.isArray
          ? ANSI.color("]", delimitersColor)
          : ANSI.color("}", delimitersColor);
      }
      return compositeDiff;
    };
    const methods = {
      value: writeValueDiff,
      prototype: writePrototypeDiff,
      indexed_value: writeIndexedValueDiff,
      property: writePropertyDiff,
      property_descriptor: writePropertyDescriptorDiff,
    };
    const writeDiff = (node, context) => {
      onNodeDisplayed(node);
      const method = methods[node.type];
      return method(node, context);
    };

    const actualValueMeta = {
      resultType: "actual",
      color: unexpectedColor,
    };
    const expectedValueMeta = {
      resultType: "expected",
      color: expectedColor,
    };
    const firstValueMeta = actualIsFirst ? actualValueMeta : expectedValueMeta;
    const secondValueMeta = actualIsFirst ? expectedValueMeta : actualValueMeta;

    let diffMessage = "";
    diffMessage += ANSI.color(firstValueMeta.resultType, colorForSame);
    diffMessage += ANSI.color(":", colorForSame);
    diffMessage += " ";
    // si le start node a une diff alors il faudrait lui mettre le signe + devant actual
    const firstValueDiff = writeDiff(startNode, {
      initialDepth: -startNode.depth,
      maxColumns: maxColumnsDefault,
      maxDepth: maxDepthDefault,
      resultType: firstValueMeta.resultType,
    });
    diffMessage += firstValueDiff;
    diffMessage += "\n";
    diffMessage += ANSI.color(secondValueMeta.resultType, colorForSame);
    diffMessage += ANSI.color(":", colorForSame);
    diffMessage += " ";
    const secondValueDiff = writeDiff(startNode, {
      initialDepth: -startNode.depth,
      maxColumns: maxColumnsDefault,
      maxDepth: maxDepthDefault,
      resultType: secondValueMeta.resultType,
    });
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

const createComparisonTree = (actualValue, expectedValue) => {
  let expectedRefId = 1;
  let actualRefId = 1;
  const compositeReferenceMap = new Map();

  const createComparisonNode = ({
    type,
    actualValue,
    expectedValue,
    parent,
    depth,
  }) => {
    const node = {
      type,
      parent,
      depth,
      actual: createValueInfo(actualValue, "actual"),
      expected: createValueInfo(expectedValue, "expected"),
      prototype: null,
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
        node.expected.referenceId = expectedRefId;
        expectedRefId++;
      } else {
        compositeReferenceMap.set(expectedValue, node);
      }
    }
    if (node.actual.isComposite) {
      if (actualReference) {
        actualReference.actual.referenceFromOthersSet.add(node);
        node.actual.referenceId = actualRefId;
        actualRefId++;
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
          depth: depth + 1,
        });
        node.prototype = prototypeNode;
        node.diff.prototype = prototypeNode.diff;
        return prototypeNode;
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
          depth: depth + 1,
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
            depth: depth + 1,
          });
          propertyDescriptorNode.property = property;
          propertyDescriptorNode.descriptor = name;
          propertyNode.descriptors[name] = propertyDescriptorNode;
          return propertyDescriptorNode;
        };
        return propertyNode;
      };
    }
    if (node.actual.isArray || node.expected.isArray) {
      node.appendIndexedValue = (index, { actualValue, expectedValue }) => {
        const indexedValueNode = createComparisonNode({
          type: "indexed_value",
          actualValue,
          expectedValue,
          parent: node,
          depth: depth + 1,
        });
        indexedValueNode.index = index;
        node.indexedValues[index] = indexedValueNode;
        return indexedValueNode;
      };
    }
    return node;
  };

  const root = createComparisonNode({
    type: "value",
    actualValue,
    expectedValue,
    depth: 0,
  });

  return { root };
};

const createValueInfo = (value, name) => {
  const composite = value === ARRAY_EMPTY_VALUE ? false : isComposite(value);
  const wellKnownId =
    value === ARRAY_EMPTY_VALUE ? "empty" : getWellKnownId(value);
  const isArray =
    composite && Array.isArray(value) && value !== Array.prototype;

  const canHaveIndexedValues = isArray;
  const canHaveProps = composite;

  return {
    value,
    valueOf: () => {
      throw new Error(`use ${name}.value`);
    },
    isComposite: composite,
    isPrimitive: !composite,
    isArray,
    canHaveIndexedValues,
    canHaveProps,
    wellKnownId,
    reference: undefined,
    referenceId: null,
    referenceFromOthersSet: new Set(),
  };
};
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
const wellKnownWeakMap = new WeakMap();
const symbolWellKnownMap = new Map();
const getWellKnownId = (value) => {
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
