import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isAssertionError, createAssertionError } from "./assertion_error.js";

const colorForExpected = ANSI.GREEN;
const colorForUnexpected = ANSI.RED;
const colorForSame = ANSI.GREY;
const addedSignColor = ANSI.GREY;
const removedSignColor = ANSI.GREY;
const removedSign = "-";
const addedSign = "+";

const wellKnownValueMap = new Map();
wellKnownValueMap.set(Object.prototype, "Object.prototype");

export const createAssert = ({ format = (v) => v } = {}) => {
  const assert = (...args) => {
    // param validation
    let firstArg;
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
    const comparisonTree = createComparisonTree(expected, actual);
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
          const descriptorBefore = node.before.value;
          const descriptorBeforeValue = descriptorBefore
            ? descriptorBefore[descriptorName]
            : undefined;
          const descriptorAfter = node.after.value;
          const descriptorAfterValue = descriptorAfter
            ? descriptorAfter[descriptorName]
            : undefined;
          const descriptorNode = node.appendPropertyDescriptor(descriptorName, {
            beforeValue: descriptorBeforeValue,
            afterValue: descriptorAfterValue,
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
          if (node.before.reference !== node.after.reference) {
            node.diff.reference = true;
            onSelfDiff();
          }
        }
        category: {
          if (ignoreDiff) {
            break category;
          }
          const isPrimitiveBefore = node.before.isPrimitive;
          const isPrimitiveAfter = node.after.isPrimitive;
          if (isPrimitiveBefore !== isPrimitiveAfter) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
          if (
            isPrimitiveBefore &&
            isPrimitiveAfter &&
            node.before.value !== node.after.value
          ) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
          const isCompositeBefore = node.before.isComposite;
          const isCompositeAfter = node.after.isComposite;
          if (isCompositeBefore !== isCompositeAfter) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
          const isArrayBefore = node.before.isArray;
          const isArrayAfter = node.after.isArray;
          if (isArrayBefore !== isArrayAfter) {
            node.diff.category = true;
            onSelfDiff();
            break category;
          }
        }
        prototype: {
          if (node.before.isComposite || node.after.isComposite) {
            const canHavePrototypeBefore = node.before.isComposite;
            const canHavePrototypeAfter = node.after.isComposite;
            const canDiffPrototypes =
              canHavePrototypeBefore && canHavePrototypeAfter;
            const prototypeAreDifferentAndWellKnown =
              (node.before.isArray && !node.after.isArray) ||
              (!node.before.isArray && node.after.isArray);
            node.canDiffPrototypes = canDiffPrototypes;
            node.prototypeAreDifferentAndWellKnown =
              prototypeAreDifferentAndWellKnown;

            const prototypeBefore = node.before.isComposite
              ? Object.getPrototypeOf(node.before.value)
              : null;
            const prototypeAfter = node.after.isComposite
              ? Object.getPrototypeOf(node.after.value)
              : null;
            const prototypeNode = node.appendPrototype({
              beforeValue: prototypeBefore,
              afterValue: prototypeAfter,
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
            const canHaveIndexedValuesBefore = node.before.canHaveIndexedValues;
            const canHaveIndexedValuesAfter = node.after.canHaveIndexedValues;
            const canDiffIndexedValues =
              canHaveIndexedValuesBefore && canHaveIndexedValuesAfter;
            node.canDiffIndexedValues = canDiffIndexedValues;

            const visitIndexedValue = (index) => {
              const hasOwnBefore = canHaveIndexedValuesBefore
                ? Object.hasOwn(node.before.value, index)
                : false;
              const hasOwnAfter = canHaveIndexedValuesAfter
                ? Object.hasOwn(node.after.value, index)
                : false;
              const valueBefore = hasOwnBefore
                ? node.before.value[index]
                : undefined;
              const valueAfter = hasOwnAfter
                ? node.after.value[index]
                : undefined;
              const indexedValueNode = node.appendIndexedValue(index, {
                beforeValue: valueBefore,
                afterValue: valueAfter,
              });

              const removed =
                hasOwnBefore && canHaveIndexedValuesAfter && !hasOwnAfter;
              if (removed) {
                indexedValueNode.diff.removed = true;
                if (canDiffIndexedValues && !ignoreDiff) {
                  indexedValueNode.diff.counters.self.removed++;
                  addNodeCausingDiff(indexedValueNode);
                }
              }
              const added =
                canHaveIndexedValuesBefore && !hasOwnBefore && hasOwnAfter;
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
            if (canHaveIndexedValuesBefore && !node.before.reference) {
              let index = 0;
              while (index < node.before.value.length) {
                visitIndexedValue(index);
                index++;
              }
            }
            if (canHaveIndexedValuesAfter && !node.after.reference) {
              let index = 0;
              while (index < node.after.value.length) {
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
            const canHavePropsBefore = node.before.canHaveProps;
            const canHavePropsAfter = node.after.canHaveProps;
            const canDiffProps = canHavePropsBefore && canHavePropsAfter;
            node.canDiffProps = canDiffProps;

            // here we want to traverse before and after but if they are not composite
            // we'll consider everything as removed or added, depending the scenario
            const visitProperty = (property) => {
              const propertyDescriptorBefore = canHavePropsBefore
                ? Object.getOwnPropertyDescriptor(node.before.value, property)
                : undefined;
              const propertyDescriptorAfter = canHavePropsAfter
                ? Object.getOwnPropertyDescriptor(node.after.value, property)
                : undefined;
              const propertyNode = node.appendProperty(property, {
                beforeValue: propertyDescriptorBefore,
                afterValue: propertyDescriptorAfter,
              });

              const removed =
                propertyDescriptorBefore &&
                canHavePropsAfter &&
                propertyDescriptorAfter === undefined;
              if (removed) {
                propertyNode.diff.removed = true;
                if (canDiffProps && !ignoreDiff) {
                  propertyNode.diff.counters.self.removed++;
                  addNodeCausingDiff(propertyNode);
                }
              }
              const added =
                canHavePropsBefore &&
                propertyDescriptorBefore === undefined &&
                propertyDescriptorAfter;
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
              canHavePropsBefore &&
              // node.after.value is a reference: was already traversed
              // - prevent infinite recursion for circular structure
              // - prevent traversing a structure already known
              !node.before.reference
            ) {
              const beforePropertyNames = Object.getOwnPropertyNames(
                node.before.value,
              );
              for (const beforePropertyName of beforePropertyNames) {
                if (node.before.isArray && beforePropertyName === "length") {
                  continue;
                }
                visitProperty(beforePropertyName);
              }
            }
            if (
              canHavePropsAfter &&
              // node.after.value is a reference: was already traversed
              // - prevent infinite recursion for circular structure
              // - prevent traversing a structure already known
              !node.after.reference
            ) {
              const afterPropertyNames = Object.getOwnPropertyNames(
                node.after.value,
              );
              for (const afterPropertyName of afterPropertyNames) {
                if (node.after.isArray && afterPropertyName === "length") {
                  continue;
                }
                if (node.properties[afterPropertyName]) {
                  // already visited
                  continue;
                }
                visitProperty(afterPropertyName);
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
      let path = "";
      for (const node of nodesFromRootToTarget) {
        if (
          startNode === rootComparison &&
          node.type === "property_descriptor" &&
          node.depth > startNodeDepth
        ) {
          node.path = path;
          startNode = node;
          break;
        }
        const { type } = node;
        if (type === "root") {
        } else if (type === "property") {
          if (path !== "") path += ".";
          path += node.property;
        } else if (type === "property_descriptor") {
          if (node.descriptor !== "value") {
            path += `[[${node.descriptor}]]`;
          }
        }
      }
    }

    const writePropertyKey = (property, color) => {
      // todo: handle property that must be between quotes,
      // handle symbols
      return ANSI.color(property, color);
    };
    const writeNestedValueDiff = (
      node,
      context,
      { property, propertyPrefix },
    ) => {
      let { mode, forceDiff } = context;
      const valueName =
        mode === "removed" || mode === "before" ? "before" : "after";
      let nestedValueDiff = "";
      const relativeDepth = node.depth - startNode.depth;
      let indent = `  `.repeat(relativeDepth);
      let keyColor;
      let delimitersColor;

      if (mode !== "traverse" && signs) {
        if (valueName === "before") {
          nestedValueDiff += ANSI.color(removedSign, removedSignColor);
          indent = indent.slice(1);
        } else {
          nestedValueDiff += ANSI.color(addedSign, addedSignColor);
          indent = indent.slice(1);
        }
      }
      if (mode === "traverse") {
        keyColor = delimitersColor = colorForSame;
      }
      if (mode === "before") {
        if (forceDiff) {
          keyColor = delimitersColor = colorForExpected;
        } else {
          keyColor = delimitersColor = colorForSame;
        }
      }
      if (mode === "after") {
        if (forceDiff) {
          keyColor = delimitersColor = colorForUnexpected;
        } else {
          keyColor = delimitersColor = colorForSame;
        }
      }
      if (mode === "removed") {
        if (signs) {
          keyColor = colorForUnexpected;
          delimitersColor = colorForExpected;
        } else {
          keyColor = delimitersColor = colorForExpected;
        }
      }
      if (mode === "added") {
        keyColor = delimitersColor = colorForUnexpected;
      }

      nestedValueDiff += indent;
      if (property) {
        if (propertyPrefix) {
          nestedValueDiff += ANSI.color(propertyPrefix, keyColor);
          nestedValueDiff += " ";
        }
        const propertyKeyFormatted = writePropertyKey(property, keyColor);
        nestedValueDiff += propertyKeyFormatted;
        nestedValueDiff += ANSI.color(":", keyColor);
        nestedValueDiff += " ";
      }

      const valueMaxColumns =
        maxColumnsDefault - stringWidth(nestedValueDiff) - ",".length;
      const valueDiff = writeValueDiff(node, {
        ...context,
        mode:
          mode === "removed"
            ? "before"
            : mode === "added"
              ? "after"
              : context.mode,
        forceDiff: context.forceDiff || node.diff.counters.self.any,
        maxDepth:
          context.maxDepth === undefined
            ? mode === "traverse"
              ? undefined
              : Math.min(node.depth + 1, maxDepthDefault)
            : context.maxDepth,
        maxColumns: valueMaxColumns,
      });
      nestedValueDiff += valueDiff;
      nestedValueDiff += ANSI.color(",", delimitersColor);
      nestedValueDiff += "\n";
      return nestedValueDiff;
    };

    const writeIndexedValueDiff = (node, context) => {
      return writeNestedValueDiff(node, context, {});
    };
    const writePrototypeDiff = (node, context) => {
      return writeNestedValueDiff(node, context, {
        showProperty: node !== startNode,
        property: node === startNode ? null : "__proto__", // "[[Prototype]]"?
      });
    };
    const writePropertyDescriptorDiff = (node, context) => {
      const valueName =
        context.mode === "removed" || context.mode === "before"
          ? "before"
          : "after";
      if (isDefaultDescriptor(node.descriptor, node[valueName].value)) {
        return "";
      }
      return writeNestedValueDiff(node, context, {
        property: node === startNode ? null : node.property,
        propertyPrefix: node.descriptor === "value" ? null : node.descriptor,
      });
    };
    const writePropertyDiff = (node, context) => {
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
        mode,
        forceDiff,
        // showProto,
        maxColumns = maxColumnsDefault,
        maxDepth = maxDepthDefault,
        collapsed,
      } = context;
      onDiffDisplayed(node);

      const valueName = mode === "before" ? "before" : "after";
      const valueInfo = node[valueName];
      let valueColor;
      let delimitersColor;
      if (mode === "before") {
        if (forceDiff) {
          delimitersColor = valueColor = colorForExpected;
        } else {
          delimitersColor = valueColor = colorForSame;
        }
      }
      if (mode === "after") {
        if (forceDiff) {
          delimitersColor = valueColor = colorForUnexpected;
        } else {
          delimitersColor = valueColor = colorForSame;
        }
      }
      if (mode === "traverse") {
        delimitersColor = valueColor = colorForSame;
      }

      if (wellKnownValueMap.has(valueInfo.value)) {
        const wellKnown = wellKnownValueMap.get(valueInfo.value);
        return ANSI.color(wellKnown, valueColor);
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
      const relativeDepth = node.depth - startNode.depth;
      const insideOverview = collapsed !== true;
      if (!collapsed) {
        const shouldCollapse =
          relativeDepth >= maxDepth || node.diff.counters.overall.any === 0;
        if (shouldCollapse) {
          collapsed = context.collapsed = shouldCollapse;
        }
      }

      const propertyNames = Object.keys(node.properties);

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

        while ((nextEntry = next())) {
          const { node: nodeInsideThisOne, write } = nextEntry;
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
                  insideDiff += previousToDisplay.write();
                }
              } else {
                for (const previousToDisplay of withoutDiffSkippedArray) {
                  skippedCounters.total--;
                  insideDiff += previousToDisplay.write();
                }
              }
              withoutDiffSkippedArray.length = 0;
            }
            insideDiff += write();
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
          if (skippedCounters.removed) {
            parts.push(
              ANSI.color(
                `${skippedCounters.removed} removed`,
                colorForUnexpected,
              ),
            );
          }
          if (skippedCounters.added) {
            parts.push(
              ANSI.color(`${skippedCounters.added} added`, colorForUnexpected),
            );
          }
          if (skippedCounters.modified) {
            parts.push(
              ANSI.color(
                `${skippedCounters.modified} modified`,
                colorForUnexpected,
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
          if (mode === "before") {
            insideDiff += ANSI.color(removedSign, removedSignColor);
            indent = indent.slice(1);
          } else if (mode === "after") {
            insideDiff += ANSI.color(addedSign, addedSignColor);
            indent = indent.slice(1);
          }
        }
        insideDiff += indent;
        insideDiff = `\n${insideDiff}`;
        return insideDiff;
      };
      const writeInsideOverview = ({ next, remainingWidth, skippedRef }) => {
        let insideOverview = "";
        let isFirst = true;
        let width = 0;
        let nextEntry;
        while ((nextEntry = next())) {
          let valueOverview = "";
          if (isFirst) {
            isFirst = false;
          } else {
            valueOverview += ANSI.color(",", delimitersColor);
            valueOverview += " ";
          }

          valueOverview += nextEntry.write();
          const valueWidth = stringWidth(valueOverview);
          if (width + valueWidth > remainingWidth) {
            skippedRef.current = true;
            break;
          }
          width += valueWidth;
          insideOverview += valueOverview;
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
                  return { node: indexedValueNode, write: writeValueDiff };
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
          const propertiesOverview = writeInsideOverview({
            next: () => {
              if (propertyIndex < propertyCount) {
                const propertyNode =
                  node.properties[propertyNames[propertyIndex]];
                propertyIndex++;
                return {
                  node: propertyNode,
                  write: () => {
                    let propertyOverview = "";
                    propertyOverview += writePropertyKey(
                      propertyNode.property,
                      valueColor,
                    );
                    propertyOverview += ANSI.color(":", delimitersColor);
                    propertyOverview += " ";
                    if (
                      propertyNode.descriptors.get[valueName].value &&
                      propertyNode.descriptors.set[valueName].value
                    ) {
                      propertyOverview += ANSI.color(`[get/set]`, valueColor);
                      return propertyOverview;
                    }
                    if (propertyNode.descriptors.get[valueName].value) {
                      propertyOverview += ANSI.color(`[get]`, valueColor);
                      return propertyOverview;
                    }
                    if (propertyNode.descriptors.set[valueName].value) {
                      propertyOverview += ANSI.color(`[set]`, valueColor);
                      return propertyOverview;
                    }
                    propertyOverview += writeValueDiff(
                      propertyNode.descriptors.value,
                      context,
                    );
                    return propertyOverview;
                  },
                };
              }
              return null;
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
                  write: () => writeDiff(indexedValueNode, context),
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
              node.diff.prototype.counters.self.any &&
              !node.prototypeAreDifferentAndWellKnown
            ) {
              prototypeDisplayed = true;
              return {
                node: node.prototype,
                write: () => writePrototypeDiff(node.prototype, context),
              };
            }
            if (index < propertyCount) {
              const propertyNode = node.properties[propertyNames[index]];
              index++;
              return {
                node: propertyNode,
                write: () => writePropertyDiff(propertyNode, context),
              };
            }
            return null;
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
      prototype: writePrototypeDiff,
      indexed_value: writeIndexedValueDiff,
      property: writePropertyDiff,
      property_descriptor: writePropertyDescriptorDiff,
    };
    const canDiffMethods = {
      prototype: (node) => node.parent.canDiffPrototypes,
      indexed_value: (node) => node.parent.canDiffIndexedValues,
      property_descriptor: (node) => node.parent.parent.canDiffProps,
    };
    const writeDiff = (node, context) => {
      const method = methods[node.type];
      if (method) {
        if (node.parent.diff.removed) {
          return method(node, {
            ...context,
            forceDiff: true,
            mode: "removed",
          });
        }
        if (node.parent.diff.added) {
          return method(node, {
            ...context,
            forceDiff: true,
            mode: "added",
          });
        }
        const canDiff = canDiffMethods[node.type](node);
        if (canDiff) {
          if (node.diff.category && !context.splitDiff) {
            let beforeAndAfterDiff = "";
            beforeAndAfterDiff += method(node, {
              ...context,
              forceDiff: false,
              splitDiff: true,
              mode: "before",
            });
            beforeAndAfterDiff += method(node, {
              ...context,
              forceDiff: false,
              splitDiff: true,
              mode: "after",
            });
            return beforeAndAfterDiff;
          }
          return method(node, {
            ...context,
            forceDiff: false,
          });
        }
        if (context.forceDiff) {
          return method(node, {
            ...context,
          });
        }
        return method(node, {
          ...context,
        });
      }
      if (context.forceDiff) {
        return writeValueDiff(node, context);
      }
      if (node.diff.category || node.diff.prototype.counters.overall.any) {
        if (node === rootComparison) {
          signs = false;
        }
        let categoryDiff = "";
        categoryDiff += writeValueDiff(node, {
          ...context,
          forceDiff: true,
          splitDiff: true,
          mode: "before",
        });
        categoryDiff += "\n";
        categoryDiff += writeValueDiff(node, {
          ...context,
          forceDiff: true,
          splitDiff: true,
          mode: "after",
        });
        return categoryDiff;
      }
      return writeValueDiff(node, context);
    };

    let diffMessage = writeDiff(startNode, { mode: "traverse" });

    let message;
    if (rootComparison.diff.category && causeCounters.total === 1) {
      message = `${ANSI.color("expected", colorForExpected)} and ${ANSI.color("actual", colorForUnexpected)} are different`;
    } else {
      message = `${ANSI.color("expected", colorForExpected)} and ${ANSI.color("actual", colorForUnexpected)} have ${causeCounters.total} ${causeCounters.total === 1 ? "difference" : "differences"}`;
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

const createComparisonTree = (beforeValue, afterValue) => {
  let beforeRefId = 1;
  let afterRefId = 1;
  const compositeReferenceMap = new Map();

  const createComparisonNode = ({
    type,
    beforeValue,
    afterValue,
    parent,
    depth,
  }) => {
    const node = {
      type,
      parent,
      depth,
      before: createValueInfo(beforeValue, "before"),
      after: createValueInfo(afterValue, "after"),
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

    const beforeReference = node.before.isComposite
      ? compositeReferenceMap.get(beforeValue)
      : undefined;
    const afterReference = node.after.isComposite
      ? compositeReferenceMap.get(afterValue)
      : undefined;
    node.before.reference = beforeReference;
    node.after.reference = afterReference;
    if (node.before.isComposite) {
      if (beforeReference) {
        beforeReference.before.referenceFromOthersSet.add(node);
        node.before.referenceId = beforeRefId;
        beforeRefId++;
      } else {
        compositeReferenceMap.set(beforeValue, node);
      }
    }
    if (node.after.isComposite) {
      if (afterReference) {
        afterReference.after.referenceFromOthersSet.add(node);
        node.after.referenceId = afterRefId;
        afterRefId++;
      } else {
        compositeReferenceMap.set(afterValue, node);
      }
    }

    if (node.before.isComposite || node.after.isComposite) {
      node.appendPrototype = ({ beforeValue, afterValue }) => {
        const prototypeNode = createComparisonNode({
          type: "prototype",
          beforeValue,
          afterValue,
          parent: node,
          depth: depth + 1,
        });
        node.prototype = prototypeNode;
        node.diff.prototype = prototypeNode.diff;
        return prototypeNode;
      };
      node.appendProperty = (property, { beforeValue, afterValue }) => {
        const propertyNode = createComparisonNode({
          type: "property",
          beforeValue,
          afterValue,
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
          { beforeValue, afterValue },
        ) => {
          const propertyDescriptorNode = createComparisonNode({
            type: "property_descriptor",
            beforeValue,
            afterValue,
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
    if (node.before.isArray || node.after.isArray) {
      node.appendIndexedValue = (index, { beforeValue, afterValue }) => {
        const indexedValueNode = createComparisonNode({
          type: "indexed_value",
          beforeValue,
          afterValue,
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
    type: "root",
    beforeValue,
    afterValue,
    depth: 0,
  });

  return { root };
};

const createValueInfo = (value, name) => {
  const composite = isComposite(value);
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
