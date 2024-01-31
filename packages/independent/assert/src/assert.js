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
        // prototype: {
        //   if (ignoreDiff) {
        //     break prototype;
        //   }
        //   if (node.before.isComposite && node.after.isComposite) {
        //     if (
        //       Object.getPrototypeOf(node.before) !==
        //       Object.getPrototypeOf(node.after)
        //     ) {
        //       node.diff.prototype = true;
        //       onSelfDiff();
        //     }
        //   }
        // }
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
                if (canDiffIndexedValues) {
                  indexedValueNode.diff.counters.self.removed++;
                  addNodeCausingDiff(indexedValueNode);
                }
              }
              const added =
                canHaveIndexedValuesBefore && !hasOwnBefore && hasOwnAfter;
              if (added) {
                indexedValueNode.diff.added = true;
                if (canDiffIndexedValues) {
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
                if (canDiffProps) {
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
                if (canDiffProps) {
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
    const writePropertyDescriptorDiff = (node, context) => {
      let { mode, forceDiff } = context;
      const valueName =
        mode === "removed" || mode === "before" ? "before" : "after";
      if (isDefaultDescriptor(node.descriptor, node[valueName].value)) {
        return "";
      }

      let propertyDescriptorDiff = "";
      const relativeDepth = node.depth - startNode.depth;
      let indent = `  `.repeat(relativeDepth);
      let keyColor;
      let delimitersColor;

      if (mode !== "traverse" && signs) {
        if (valueName === "before") {
          propertyDescriptorDiff += ANSI.color(removedSign, removedSignColor);
          indent = indent.slice(1);
        } else {
          propertyDescriptorDiff += ANSI.color(addedSign, addedSignColor);
          indent = indent.slice(1);
        }
      }
      if (mode === "traverse") {
        keyColor = delimitersColor = colorForSame;
      }
      if (mode === "before") {
        if (forceDiff || node.diff.counters.overall.any) {
          keyColor = delimitersColor = colorForExpected;
        } else {
          keyColor = delimitersColor = colorForSame;
        }
      }
      if (mode === "after") {
        if (forceDiff || node.diff.counters.overall.any) {
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

      propertyDescriptorDiff += indent;
      if (node !== startNode) {
        if (node.descriptor !== "value") {
          propertyDescriptorDiff += ANSI.color(node.descriptor, keyColor);
          propertyDescriptorDiff += " ";
        }
        const propertyKeyFormatted = writePropertyKey(node.property, keyColor);
        propertyDescriptorDiff += propertyKeyFormatted;
        propertyDescriptorDiff += ANSI.color(":", keyColor);
        propertyDescriptorDiff += " ";
      }

      const valueDiff = writeValueDiff(node, {
        ...context,
        mode:
          mode === "removed"
            ? "before"
            : mode === "added"
              ? "after"
              : context.mode,
        maxDepth:
          context.maxDepth === undefined
            ? mode === "traverse"
              ? undefined
              : Math.min(node.depth + 1, maxDepthDefault)
            : context.maxDepth,
        maxColumns:
          maxColumnsDefault - stringWidth(propertyDescriptorDiff) - ",".length,
      });
      propertyDescriptorDiff += valueDiff;
      propertyDescriptorDiff += ANSI.color(",", delimitersColor);
      propertyDescriptorDiff += "\n";
      return propertyDescriptorDiff;
    };
    const writeValueDiff = (node, context) => {
      let {
        mode,
        forceDiff,
        maxColumns = maxColumnsDefault,
        maxDepth = maxDepthDefault,
        collapsed,
      } = context;

      if (causeSet.has(node)) {
        causeSet.delete(node);
        causeCounters.displayed++;
      } else if (causeSet.has(node.parent)) {
        causeSet.delete(node.parent);
        causeCounters.displayed++;
      }

      const valueName = mode === "before" ? "before" : "after";
      const valueInfo = node[valueName];
      let valueColor;
      if (mode === "before") {
        if (forceDiff || node.diff.counters.self.any) {
          valueColor = colorForExpected;
        } else {
          valueColor = colorForSame;
        }
      }
      if (mode === "after") {
        if (forceDiff || node.diff.counters.self.any) {
          valueColor = colorForUnexpected;
        } else {
          valueColor = colorForSame;
        }
      }
      if (mode === "traverse") {
        valueColor = colorForSame;
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
      const delimitersColor =
        mode === "before"
          ? colorForExpected
          : mode === "after"
            ? colorForUnexpected
            : colorForSame;
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

      const writeInsideDiff = ({ next, write, skippedName }) => {
        let insideDiff = "";
        let indent = "  ".repeat(relativeDepth);
        const withoutDiffSkippedArray = [];
        const skippedCounters = {
          total: 0,
          diff: 0,
        };
        let diffCount = 0;
        let nodeInsideThisOne;
        while ((nodeInsideThisOne = next())) {
          if (nodeInsideThisOne.diff.counters.overall.any) {
            diffCount++;
            // too many diff
            if (diffCount > maxDiffPerObject) {
              skippedCounters.total++;
              skippedCounters.diff +=
                nodeInsideThisOne.diff.counters.overall.any;
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
                  insideDiff += write(previousToDisplay);
                }
              } else {
                for (const previousToDisplay of withoutDiffSkippedArray) {
                  skippedCounters.total--;
                  insideDiff += write(previousToDisplay);
                }
              }
              withoutDiffSkippedArray.length = 0;
            }
            insideDiff += write(nodeInsideThisOne);
            continue;
          }
          skippedCounters.total++;
          withoutDiffSkippedArray.push(nodeInsideThisOne);
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
              insideDiff += write(nextToDisplay);
            }
          } else {
            for (const nextToDisplay of withoutDiffSkippedArray) {
              skippedCounters.total--;
              insideDiff += write(nextToDisplay);
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
          if (skippedCounters.diff) {
            belowSummary += " ";
            belowSummary += ANSI.color("(", delimitersColor);
            belowSummary += ANSI.color(
              `${skippedCounters.diff}`,
              colorForUnexpected,
            );
            belowSummary += ANSI.color(" diff)", delimitersColor);
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
      const writeInsideOverview = ({
        next,
        write,
        remainingWidth,
        skippedRef,
      }) => {
        let insideOverview = "";
        let nextNode;
        let isFirst = true;
        let width = 0;
        while ((nextNode = next())) {
          let valueOverview = "";
          if (isFirst) {
            isFirst = false;
          } else {
            valueOverview += ANSI.color(",", delimitersColor);
            valueOverview += " ";
          }

          valueOverview += write(nextNode, context);
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
                  return indexedValueNode;
                }
                return null;
              },
              write: writeValueDiff,
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
                return propertyNode;
              }
              return null;
            },
            write: (propertyNode) => {
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
                return indexedValueNode;
              }
              return null;
            },
            write: (indexedValueNode) => {
              let indexedValueDiff = "";
              indexedValueDiff += writeDiff(indexedValueNode, {
                ...context,
              });
              return indexedValueDiff;
            },
          });
          compositeDiff += ANSI.color("[", delimitersColor);
          compositeDiff += insideDiff;
        }
        const propertyCount = propertyNames.length;
        let index = 0;
        let insideDiff = writeInsideDiff({
          skippedName: "prop",
          next: () => {
            if (index < propertyCount) {
              const propertyNode = node.properties[propertyNames[index]];
              index++;
              return propertyNode;
            }
            return null;
          },
          write: (propertyNode) => {
            let propertyDiff = "";
            const descriptorNames = Object.keys(propertyNode.descriptors);
            for (const descriptorName of descriptorNames) {
              const descriptorNode = propertyNode.descriptors[descriptorName];
              propertyDiff += writeDiff(descriptorNode, {
                ...context,
                mode: context.mode,
              });
            }
            return propertyDiff;
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
    const writeDiff = (node, context) => {
      if (node.type === "property_descriptor") {
        if (context.forceDiff) {
          return writePropertyDescriptorDiff(node, context);
        }
        if (node.parent.diff.removed) {
          return writePropertyDescriptorDiff(node, {
            ...context,
            forceDiff: true,
            mode: "removed",
          });
        }
        if (node.parent.diff.added) {
          return writePropertyDescriptorDiff(node, {
            ...context,
            forceDiff: true,
            mode: "added",
          });
        }
        if (node.diff.category) {
          let categoryDiff = "";
          categoryDiff += writePropertyDescriptorDiff(node, {
            ...context,
            forceDiff: true,
            mode: "before",
          });
          categoryDiff += writePropertyDescriptorDiff(node, {
            ...context,
            forceDiff: true,
            mode: "after",
          });
          return categoryDiff;
        }
        return writePropertyDescriptorDiff(node, context);
      }
      if (context.forceDiff) {
        return writeValueDiff(node, context);
      }
      if (node.diff.category || node.diff.prototype) {
        if (node === rootComparison) {
          signs = false;
        }
        let categoryDiff = "";
        categoryDiff += writeValueDiff(node, {
          ...context,
          forceDiff: true,
          mode: "before",
        });
        categoryDiff += "\n";
        categoryDiff += writeValueDiff(node, {
          ...context,
          forceDiff: true,
          mode: "after",
        });
        return categoryDiff;
      }
      return writeValueDiff(node, context);
    };

    let diffMessage = writeDiff(startNode, { mode: "traverse" });

    let message;
    if (rootComparison.diff.category) {
      message = `${ANSI.color("expected", colorForExpected)} and ${ANSI.color("actual", colorForUnexpected)} are different`;
    } else {
      message = `${ANSI.color("expected", colorForExpected)} and ${ANSI.color("actual", colorForUnexpected)} have ${causeCounters.total} ${causeCounters.total === 1 ? "difference" : "differences"}`;
    }
    message += ":";
    message += "\n\n";
    const infos = [];
    const diffNotDisplayed = causeCounters.total - causeCounters.displayed;
    if (diffNotDisplayed) {
      if (causeCounters.displayed === 1) {
        infos.push(
          `to improve readability only ${causeCounters.displayed} diff is displayed`,
        );
      } else {
        infos.push(
          `to improve readability only ${causeCounters.displayed} diffs are displayed`,
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
  const beforeCompositeReferenceMap = new Map();
  const afterCompositeReferenceMap = new Map();

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

    if (node.before.isComposite) {
      const beforeReference = beforeCompositeReferenceMap.get(beforeValue);
      node.before.reference = beforeReference;
      if (beforeReference) {
        beforeReference.before.referenceFromOthersSet.add(node);
        node.before.referenceId = beforeRefId;
        beforeRefId++;
      } else {
        beforeCompositeReferenceMap.set(beforeValue, node);
      }
    }
    if (node.after.isComposite) {
      const afterReference = afterCompositeReferenceMap.get(afterValue);
      node.after.reference = afterReference;
      if (afterReference) {
        afterReference.after.referenceFromOthersSet.add(node);
        node.after.referenceId = afterRefId;
        afterRefId++;
      } else {
        afterCompositeReferenceMap.set(afterValue, node);
      }
    }

    if (node.before.isComposite || node.after.isComposite) {
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
  const isArray = composite && Array.isArray(value);

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
