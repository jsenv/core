import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isAssertionError, createAssertionError } from "./assertion_error.js";

const removedSign = UNICODE.FAILURE_RAW;
const addedSign = UNICODE.FAILURE_RAW;
const unexpectedSign = UNICODE.FAILURE_RAW;
const colorForSame = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.RED;
const unexpectedColor = ANSI.RED;
const expectedColor = ANSI.GREEN;
const unexpectedSignColor = ANSI.GREY;
const removedSignColor = ANSI.GREY;
const addedSignColor = ANSI.GREY;

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
      maxPropertyBeforeDiff = 2,
      maxPropertyAfterDiff = 2,
    } = firstArg;
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
    const onDiffDisplayed = (node) => {
      if (causeSet.has(node)) {
        causeSet.delete(node);
        causeCounters.displayed++;
      } else if (causeSet.has(node.parent)) {
        causeSet.delete(node.parent);
        causeCounters.displayed++;
      }
    };

    const settleCounters = (node) => {
      const { counters } = node.diff;
      const { self, inside, overall } = counters;
      self.any = self.modified + self.removed + self.added;
      inside.any = inside.modified + inside.removed + inside.added;
      overall.modified = self.modified + inside.modified;
      overall.removed = self.removed + inside.removed;
      overall.added = self.added + inside.added;
      overall.any = self.any + inside.any;
    };
    const appendCounters = (counter, otherCounter) => {
      counter.any += otherCounter.any;
      counter.modified += otherCounter.modified;
      counter.removed += otherCounter.removed;
      counter.added += otherCounter.added;
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
                : undefined;
              const expectedValue = expectedHasOwn
                ? node.expected.value[index]
                : undefined;
              const indexedValueNode = node.appendIndexedValue(index, {
                actualValue,
                expectedValue,
              });

              const removed =
                expectedHasOwn && actualCanHaveIndexedValues && !actualHasOwn;
              if (removed) {
                indexedValueNode.diff.removed = true;
                if (canDiffIndexedValues && !ignoreDiff) {
                  indexedValueNode.diff.counters.self.removed++;
                  addNodeCausingDiff(indexedValueNode);
                }
              }
              const added =
                expectedCanHaveIndexedValues && !expectedHasOwn && actualHasOwn;
              if (added) {
                indexedValueNode.diff.added = true;
                if (canDiffIndexedValues && !ignoreDiff) {
                  indexedValueNode.diff.counters.self.added++;
                  addNodeCausingDiff(indexedValueNode);
                }
              }
              visit(indexedValueNode, {
                ignoreDiff:
                  ignoreDiff || !canDiffIndexedValues || added || removed,
              });
              appendCounters(
                node.diff.counters.inside,
                indexedValueNode.diff.counters.overall,
              );
            };
            if (expectedCanHaveIndexedValues && !node.expected.reference) {
              let index = 0;
              while (index < node.expected.value.length) {
                visitIndexedValue(index);
                index++;
              }
            }
            if (actualCanHaveIndexedValues && !node.actual.reference) {
              let index = 0;
              while (index < node.actual.value.length) {
                if (node.indexedValues[index]) {
                  // already visited
                  continue;
                }
                visitIndexedValue(index);
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

              const removed =
                expectedPropertyDescriptor &&
                actualCanHaveProps &&
                !actualPropertyDescriptor;
              if (removed) {
                propertyNode.diff.removed = true;
                if (canDiffProps && !ignoreDiff) {
                  propertyNode.diff.counters.self.removed++;
                  addNodeCausingDiff(propertyNode);
                }
              }
              const added =
                expectedCanHaveProps &&
                !expectedPropertyDescriptor &&
                actualPropertyDescriptor;
              if (added) {
                propertyNode.diff.added = true;
                if (canDiffProps && !ignoreDiff) {
                  propertyNode.diff.counters.self.added++;
                  addNodeCausingDiff(propertyNode);
                }
              }
              visit(propertyNode, {
                ignoreDiff: ignoreDiff || !canDiffProps || added || removed,
              });
              appendCounters(
                node.diff.counters.inside,
                propertyNode.diff.counters.overall,
              );
            };
            if (
              expectedCanHaveProps &&
              // node.after.value is a reference: was already traversed
              // - prevent infinite recursion for circular structure
              // - prevent traversing a structure already known
              !node.expected.reference &&
              !node.expected.wellKnownId
            ) {
              const expectedPropertyNames = Object.getOwnPropertyNames(
                node.expected.value,
              );
              for (const expectedPropertyName of expectedPropertyNames) {
                if (
                  node.expected.isArray &&
                  expectedPropertyName === "length"
                ) {
                  continue;
                }
                visitProperty(expectedPropertyName);
              }
            }
            if (
              actualCanHaveProps &&
              // node.after.value is a reference: was already traversed
              // - prevent infinite recursion for circular structure
              // - prevent traversing a structure already known
              !node.actual.reference &&
              !node.actual.wellKnownId
            ) {
              const actualPropertyNames = Object.getOwnPropertyNames(
                node.actual.value,
              );
              for (const actualPropertyName of actualPropertyNames) {
                if (node.actual.isArray && actualPropertyName === "length") {
                  continue;
                }
                if (node.properties[actualPropertyName]) {
                  // already visited
                  continue;
                }
                visitProperty(actualPropertyName);
              }
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

    let signs = true;
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
      let { resultType, forceDiff, added, removed } = context;
      if (
        node.type === "indexed_value" ||
        node.type === "property_descriptor"
      ) {
        if (node.parent.diff.removed) {
          removed = true;
          forceDiff = true;
        }
        if (node.parent.diff.added) {
          added = true;
          forceDiff = true;
        }
      }
      if (node.type === "property_descriptor") {
        if (node.parent.parent.diff.category) {
          forceDiff = true;
        }
        if (isDefaultDescriptor(node.descriptor, node[resultType].value)) {
          return null;
        }
      }

      return { ...context, forceDiff, removed, added };
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
      let { resultType, forceDiff, added, removed, maxDepth, initialDepth } =
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
        } else if (forceDiff) {
          keyColor = delimitersColor = unexpectedColor;
        } else {
          keyColor = delimitersColor = colorForSame;
        }
      } else if (removed) {
        keyColor = delimitersColor = removedColor;
      } else if (forceDiff) {
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
        } else if (forceDiff || node.diff.counters.self.any) {
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
        if (forceDiff || node.diff.counters.self.any) {
          maxDepth = Math.min(node.depth + 1, maxDepth);
        }
        const valueDiff = writeValueDiff(node, {
          ...context,
          maxDepth,
          maxColumns: valueMaxColumns,
        });
        nestedValueDiff += valueDiff;
      }
      if (!context.collapsed) {
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
          return writePropertyDescriptorDiff(node.descriptors.get, context);
        }
        if (node.descriptors.get[context.resultType].value) {
          return writePropertyDescriptorDiff(node.descriptors.get, context);
        }
        if (node.descriptors.set[context.resultType].value) {
          return writePropertyDescriptorDiff(node.descriptors.set, context);
        }
        return writePropertyDescriptorDiff(node.descriptors.value, context);
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
        forceDiff,
        added,
        removed,
        maxColumns,
        maxDepth,
        collapsed,
        initialDepth,
      } = context;
      onDiffDisplayed(node);

      forceDiff = forceDiff || node.diff.counters.self.any > 0;

      const valueInfo = node[resultType];
      let valueColor;
      let delimitersColor;
      if (resultType === "actual") {
        if (added) {
          delimitersColor = valueColor = addedColor;
        } else if (forceDiff) {
          delimitersColor = valueColor = unexpectedColor;
        } else {
          delimitersColor = valueColor = colorForSame;
        }
      } else if (removed) {
        delimitersColor = valueColor = removedColor;
      } else if (forceDiff) {
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
          return ANSI.color("[get]", valueColor);
        }
        if (node.descriptor === "set") {
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

      const writeInsideDiff = ({ next, skippedName }) => {
        let insideDiff = "";
        let indent = "  ".repeat(relativeDepth);
        const withoutDiffSkippedArray = [];
        const skippedCounters = {
          total: 0,
          added: 0,
          removed: 0,
          modified: 0,
        };
        let diffCount = 0;
        let nextEntry;
        let isFirstNestedValue = true;
        const appendNestedValueDiff = (diff) => {
          if (context.collapsed) {
            insideDiff += diff;
            return;
          }
          if (isFirstNestedValue) {
            isFirstNestedValue = false;
            insideDiff += diff;
            return;
          }
          // insideDiff += ANSI.color(",", delimitersColor);
          // insideDiff += "\n";
          insideDiff += diff;
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
              onDiffDisplayed(nodeInsideThisOne);
              skippedCounters.total++;
              if (nodeInsideThisOne.diff.removed) {
                skippedCounters.removed++;
              } else if (nodeInsideThisOne.diff.added) {
                skippedCounters.added++;
              } else {
                skippedCounters.modified++;
              }
              continue;
            }
            // first write property eventually skipped
            const withoutDiffSkippedCount = withoutDiffSkippedArray.length;
            if (withoutDiffSkippedCount) {
              if (withoutDiffSkippedCount > maxPropertyBeforeDiff) {
                const previousToDisplayArray = withoutDiffSkippedArray.slice(
                  -(maxPropertyBeforeDiff - 1),
                );
                const indexAboveCount = withoutDiffSkippedCount - 1;
                const arrowSign = diffCount > 1 ? `↕` : `↑`;
                insideDiff += `${indent}  `;
                insideDiff += ANSI.color(
                  `${arrowSign} ${indexAboveCount} ${skippedName}s ${arrowSign}`,
                  delimitersColor,
                );
                skippedCounters.total -= indexAboveCount;
                insideDiff += "\n";
                for (const previousToDisplay of previousToDisplayArray) {
                  skippedCounters.total--;
                  appendNestedValueDiff(previousToDisplay.write());
                }
              } else {
                for (const previousToDisplay of withoutDiffSkippedArray) {
                  skippedCounters.total--;
                  appendNestedValueDiff(previousToDisplay.write());
                }
              }
              withoutDiffSkippedArray.length = 0;
            }
            appendNestedValueDiff(write());
            continue;
          }
          skippedCounters.total++;
          withoutDiffSkippedArray.push(nextEntry);
          // does not have a diff
          // will either be written when we encounter a diff
          // or be skipped
        }
        let belowSummary = "";
        // now display the values below
        const withoutDiffSkippedCount = withoutDiffSkippedArray.length;
        if (withoutDiffSkippedCount) {
          if (withoutDiffSkippedCount > maxPropertyAfterDiff) {
            const nextToDisplayArray = withoutDiffSkippedArray.slice(
              0,
              maxPropertyAfterDiff - 1,
            );
            for (const nextToDisplay of nextToDisplayArray) {
              skippedCounters.total--;
              insideDiff += nextToDisplay.write();
            }
          } else {
            for (const nextToDisplay of withoutDiffSkippedArray) {
              skippedCounters.total--;
              insideDiff += nextToDisplay.write();
            }
          }
        }
        if (skippedCounters.total) {
          belowSummary += ANSI.color(
            skippedCounters.total === 1
              ? `1 ${skippedName}`
              : `${skippedCounters.total} ${skippedName}s`,
            delimitersColor,
          );
          const parts = [];
          if (resultType === "actual") {
            if (skippedCounters.added) {
              parts.push(
                ANSI.color(`${skippedCounters.added} added`, addedColor),
              );
            }
            if (skippedCounters.modified) {
              parts.push(
                ANSI.color(
                  `${skippedCounters.modified} modified`,
                  unexpectedColor,
                ),
              );
            }
          } else if (skippedCounters.removed) {
            parts.push(
              ANSI.color(`${skippedCounters.removed} removed`, removedColor),
            );
          }

          if (parts.length) {
            belowSummary += ` `;
            belowSummary += ANSI.color(`(`, delimitersColor);
            belowSummary += parts.join(" ");
            belowSummary += ANSI.color(`)`, delimitersColor);
          }
        }
        if (belowSummary) {
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
            } else if (context.forceDiff || node.diff.counters.self.any) {
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
      const writeInsideOverview = ({ next, remainingWidth, skippedRef }) => {
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
            skippedRef.current = true;
            break;
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
        return insideOverview;
      };
      const wrapInsideOverview = (
        insideOverview,
        { prefix, openBracket, closeBracket },
      ) => {
        let insideOverviewWrapped = "";
        insideOverviewWrapped += ANSI.color(prefix, delimitersColor);
        insideOverviewWrapped += " ";
        insideOverviewWrapped += ANSI.color(openBracket, delimitersColor);
        if (insideOverview) {
          insideOverviewWrapped += insideOverview;
          insideOverviewWrapped += ANSI.color(",", delimitersColor);
          insideOverviewWrapped += " ";
        }
        insideOverviewWrapped += ANSI.color(`...`, valueColor);
        insideOverviewWrapped += ANSI.color(closeBracket, delimitersColor);
        return insideOverviewWrapped;
      };

      inside: {
        const propertyNames = Object.keys(valueInfo.value);

        if (collapsed && insideOverview) {
          let overview = "";
          let overviewWidth = 0;
          if (valueInfo.isArray) {
            const length = valueInfo.value.length;
            const estimatedCollapsedBoilerplate = `Array(${length}) [, ...]`;
            const estimatedCollapsedBoilerplateWidth =
              estimatedCollapsedBoilerplate.length;
            let index = 0;
            const indexedValueSkippedRef = { current: false };
            const indexedValuesOverview = writeInsideOverview({
              next: () => {
                if (index < length) {
                  const indexedValueNode = node.indexedValues[index];
                  index++;
                  return {
                    node: indexedValueNode,
                    write: () =>
                      writeDiff(indexedValueNode, {
                        ...context,
                        forceDiff,
                        collapsed,
                      }),
                  };
                }
                return null;
              },
              skippedRef: indexedValueSkippedRef,
              remainingWidth: maxColumns - estimatedCollapsedBoilerplateWidth,
            });

            if (indexedValueSkippedRef.current) {
              overview += wrapInsideOverview(indexedValuesOverview, {
                prefix: `Array(${length})`,
                openBracket: "[",
                closeBracket: "]",
              });
              compositeDiff += overview;
              break inside;
            }
            overview += ANSI.color("[", delimitersColor);
            overview += "[".length;
            if (insideOverview) {
              overview += insideOverview;
              overviewWidth += stringWidth(insideOverview);
            }
          }

          const propertyCount = propertyNames.length;
          const estimatedCollapsedBoilerplate = `Object(${propertyCount}) { , ... }`;
          const estimatedCollapsedBoilerplateWidth =
            estimatedCollapsedBoilerplate.length;
          let propertyIndex = 0;
          const propertiesSkippedRef = { current: false };

          const getNext = () => {
            if (propertyIndex >= propertyCount) {
              return null;
            }
            const propertyNode = node.properties[propertyNames[propertyIndex]];
            propertyIndex++;
            return propertyNode;
          };
          const propertiesOverview = writeInsideOverview({
            next: () => {
              const propertyNode = getNext();
              if (!propertyNode) {
                return null;
              }
              return {
                node: propertyNode,
                write: () => {
                  return writePropertyDiff(propertyNode, {
                    ...context,
                    forceDiff,
                    collapsed,
                  });
                },
              };
            },
            skippedRef: propertiesSkippedRef,
            remainingWidth:
              maxColumns - overviewWidth - estimatedCollapsedBoilerplateWidth,
          });
          if (propertiesSkippedRef.current) {
            if (valueInfo.isArray) {
              overview += wrapInsideOverview(propertiesOverview);
              overview += ANSI.color("]", delimitersColor);
            } else {
              overview += wrapInsideOverview(propertiesOverview, {
                prefix: `Object(${propertyCount})`,
                openBracket: "{ ",
                closeBracket: " }",
                spaces: true,
              });
            }
            compositeDiff += overview;
            break inside;
          }
          if (!valueInfo.isArray) {
            overview += ANSI.color("{", delimitersColor);
          }
          if (propertiesOverview) {
            overview += " ";
            overview += propertiesOverview;
            overview += " ";
            overviewWidth += stringWidth(` ${propertiesOverview} `);
          }
          if (!valueInfo.isArray) {
            overview += ANSI.color("}", delimitersColor);
            overviewWidth += "{}".length;
          }
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
          compositeDiff += ANSI.color("Object(", delimitersColor);
          compositeDiff += ANSI.color(
            `${propertyNames.length}`,
            delimitersColor,
          );
          compositeDiff += ANSI.color(")", delimitersColor);
          break inside;
        }
        if (valueInfo.isArray) {
          const length = valueInfo.value.length;
          let index = 0;
          let insideDiff = writeInsideDiff({
            skippedName: "value",
            next: () => {
              if (index < length) {
                const indexedValueNode = node.indexedValues[index];
                index++;
                return {
                  node: indexedValueNode,
                  write: () => {
                    return writeDiff(indexedValueNode, {
                      ...context,
                      forceDiff,
                      collapsed,
                    });
                  },
                };
              }
              return null;
            },
          });
          compositeDiff += ANSI.color("[", delimitersColor);
          compositeDiff += insideDiff;
        }
        const propertyCount = propertyNames.length;
        let index = 0;
        let prototypeDisplayed = false;
        let insideDiff = writeInsideDiff({
          skippedName: "prop",
          next: () => {
            if (
              !prototypeDisplayed &&
              node.diff.prototype.counters.overall.any &&
              !node.prototypeAreDifferentAndWellKnown
            ) {
              prototypeDisplayed = true;
              return {
                node: node.prototype,
                write: () => {
                  return writePrototypeDiff(node.prototype, {
                    ...context,
                    forceDiff,
                    collapsed,
                  });
                },
              };
            }
            if (index >= propertyCount) {
              return null;
            }
            const propertyNode = node.properties[propertyNames[index]];
            index++;
            return {
              node: propertyNode,
              write: () => {
                return writePropertyDiff(propertyNode, {
                  ...context,
                  forceDiff,
                  collapsed,
                });
              },
            };
          },
        });
        if (!valueInfo.isArray) {
          compositeDiff += ANSI.color("{", delimitersColor);
        }
        compositeDiff += insideDiff;
        if (valueInfo.isArray) {
          compositeDiff += ANSI.color("]", delimitersColor);
        } else {
          compositeDiff += ANSI.color("}", delimitersColor);
        }
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
      initialDepth: startNode.depth,
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
      initialDepth: startNode.depth,
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
  const composite = isComposite(value);
  const wellKnownId = getWellKnownId(value);
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
