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
      self.any = self.removal + self.addition;
      inside.any = inside.removal + inside.addition;
      overall.removal = self.removal + inside.removal;
      overall.addition = self.addition + inside.addition;
      overall.any = self.any + inside.any;
    };
    const appendCounters = (counter, otherCounter) => {
      counter.any += otherCounter.any;
      counter.removal += otherCounter.removal;
      counter.addition += otherCounter.addition;
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
          node.diff.counters.self.removal++;
          node.diff.counters.self.addition++;
        };

        identity: {
          if (!ignoreDiff) {
            if (node.before.isPrimitive || node.after.isPrimitive) {
              if (node.before.value !== node.after.value) {
                node.diff.identity = true;
                onSelfDiff();
              }
            }
          }
        }
        reference: {
          if (!ignoreDiff) {
            if (node.before.reference !== node.after.reference) {
              node.diff.reference = true;
              onSelfDiff();
            }
          }
        }
        properties: {
          const canHavePropsBefore = node.before.isComposite;
          const canHavePropsAfter = node.after.isComposite;

          // here we want to traverse before and after but if they are not composite
          // we'll consider everything as removed or added, depending the scenario
          const visitProperty = (property) => {
            if (!canHavePropsBefore || !canHavePropsAfter) {
              ignoreDiff = true;
            }
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
              !ignoreDiff &&
              propertyDescriptorBefore &&
              canHavePropsAfter &&
              propertyDescriptorAfter === undefined;
            if (removed) {
              propertyNode.diff.removed = true;
              propertyNode.diff.counters.self.removal++;
              addNodeCausingDiff(propertyNode);
            }
            const added =
              !ignoreDiff &&
              canHavePropsBefore &&
              propertyDescriptorBefore === undefined &&
              propertyDescriptorAfter;
            if (added) {
              propertyNode.diff.added = true;
              propertyNode.diff.counters.self.addition++;
              addNodeCausingDiff(propertyNode);
            }
            visit(propertyNode, {
              ignoreDiff,
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
              if (node.properties[afterPropertyName]) {
                // already visited
                continue;
              }
              visitProperty(afterPropertyName);
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
      !rootComparison.diff.identity
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
      if (
        !node.diff.counters.self.any &&
        isDefaultDescriptor(node.descriptor, node.before.value)
      ) {
        return "";
      }
      let { mode, modified } = context;
      let propertyDescriptorDiff = "";
      const relativeDepth = node.depth - startNode.depth;
      let indent = `  `.repeat(relativeDepth);
      let keyColor;
      let delimitersColor;

      if (mode === "removed") {
        if (isDefaultDescriptor(node.descriptor, node.before.value)) {
          return "";
        }
        if (signs) {
          propertyDescriptorDiff += ANSI.color(removedSign, removedSignColor);
          indent = indent.slice(1);
        }
        if (modified) {
          keyColor = delimitersColor = colorForSame;
        } else {
          // non of the parent must be
          // indirect way to check we are generating root comparison identity failure
          keyColor = delimitersColor = colorForExpected;
        }
      }
      if (mode === "added") {
        if (isDefaultDescriptor(node.descriptor, node.after.value)) {
          return "";
        }
        if (signs) {
          propertyDescriptorDiff += ANSI.color(addedSign, addedSignColor);
          indent = indent.slice(1);
        }
        keyColor = delimitersColor = modified
          ? colorForSame
          : colorForUnexpected;
      }
      if (mode === "traverse") {
        keyColor = delimitersColor = colorForSame;
      }

      propertyDescriptorDiff += indent;
      if (node !== startNode) {
        if (node.descriptor !== "value") {
          propertyDescriptorDiff += ANSI.color(node.descriptor, keyColor);
          propertyDescriptorDiff += " ";
        }
        const propertyKeyFormatted = writePropertyKey(node.property, keyColor);
        propertyDescriptorDiff += propertyKeyFormatted;
        propertyDescriptorDiff += ANSI.color(":", delimitersColor);
        propertyDescriptorDiff += " ";
      }

      const valueDiff = writeValueDiff(node, {
        mode,
        context: {
          ...context,
          maxDepth:
            context.maxDepth === undefined
              ? mode === "removed" || mode === "added"
                ? Math.min(node.depth + 1, maxDepthDefault)
                : undefined
              : context.maxDepth,
          maxColumns:
            maxColumnsDefault -
            stringWidth(propertyDescriptorDiff) -
            ",".length,
        },
      });
      propertyDescriptorDiff += valueDiff;
      propertyDescriptorDiff += ANSI.color(",", delimitersColor);
      propertyDescriptorDiff += "\n";
      return propertyDescriptorDiff;
    };
    const writeValueDiff = (node, context) => {
      let {
        mode,
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

      const valueName = mode === "added" ? "after" : "before";
      const valueInfo = node[valueName];
      const valueColor =
        mode === "removed"
          ? colorForExpected
          : mode === "added"
            ? colorForUnexpected
            : colorForSame;
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
        mode === "removed"
          ? colorForExpected
          : mode === "added"
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
      let compositePrefix = ANSI.color("{", delimitersColor);
      let compositeBody = "";
      let compositeSuffix = ANSI.color("}", delimitersColor);
      properties_diff: {
        const propertyNames = Object.keys(node.properties);
        const propertyCount = propertyNames.length;
        if (propertyCount === 0) {
          break properties_diff;
        }
        const propertiesOverview = collapsed !== true;
        if (!collapsed) {
          const shouldCollapse =
            relativeDepth >= maxDepth || node.diff.counters.overall.any === 0;
          if (shouldCollapse) {
            collapsed = context.collapsed = shouldCollapse;
          }
        }
        if (collapsed) {
          if (propertiesOverview) {
            let propertiesDiff = "";
            let lineWidth = `{  }`.length;
            const estimatedCollapsedBoilerplateWidth =
              `Object(${propertyCount}) , ...`.length;
            for (const property of propertyNames) {
              let propertyDiff = "";
              const propertyNode = node.properties[property];
              if (propertiesDiff.length === 0) {
                propertyDiff += " ";
              } else {
                propertyDiff += ANSI.color(",", delimitersColor);
                propertyDiff += " ";
              }
              propertyDiff += writePropertyKey(property, valueColor);
              propertyDiff += ANSI.color(":", delimitersColor);
              propertyDiff += " ";

              if (
                propertyNode.descriptors.get[valueName].value &&
                propertyNode.descriptors.set[valueName].value
              ) {
                propertyDiff += ANSI.color(`[get/set]`, valueColor);
              } else if (propertyNode.descriptors.get[valueName].value) {
                propertyDiff += ANSI.color(`[get]`, valueColor);
              } else if (propertyNode.descriptors.set[valueName].value) {
                propertyDiff += ANSI.color(`[set]`, valueColor);
              } else {
                propertyDiff += writeValueDiff(propertyNode.descriptors.value, {
                  mode,
                  context,
                });
              }
              lineWidth += stringWidth(propertyDiff);
              if (lineWidth + estimatedCollapsedBoilerplateWidth > maxColumns) {
                compositePrefix = ANSI.color(
                  `Object(${propertyCount}) {`,
                  delimitersColor,
                );
                compositeSuffix = ANSI.color("}", delimitersColor);
                propertiesDiff += ANSI.color(",", delimitersColor);
                propertiesDiff += " ";
                // here ideally the color should be
                // red if there is a - in remaining props
                // green if a + in remaining props
                // grey otherwise
                propertiesDiff += ANSI.color(`...`, valueColor);
                break;
              }
              propertiesDiff += propertyDiff;
            }
            compositeBody += propertiesDiff;
            compositeBody += " ";
          } else {
            compositePrefix = ANSI.color("Object(", delimitersColor);
            compositeSuffix = ANSI.color(")", delimitersColor);
            compositeBody += ANSI.color(`${propertyCount}`, delimitersColor);
          }
        } else {
          let indent = "  ".repeat(relativeDepth);
          compositeBody += "\n";

          const writePropertyDiff = (property) => {
            const propertyNode = node.properties[property];
            const descriptorNames = Object.keys(propertyNode.descriptors);
            for (const descriptorName of descriptorNames) {
              const descriptorNode = propertyNode.descriptors[descriptorName];
              compositeBody += writePropertyDescriptorDiff(
                descriptorNode,
                context,
              );
            }
          };

          let index = 0;
          const maxPropertyAbove = 2;
          const maxPropertyBelow = 2;
          const propertyWithoutDiffSkippedArray = [];
          const skippedCounters = {
            total: 0,
            diff: 0,
          };
          let propertyDiffCount = 0;
          while (index < propertyNames.length) {
            const property = propertyNames[index];
            index++;
            const propertyNode = node.properties[property];
            if (propertyNode.diff.counters.overall.any) {
              propertyDiffCount++;
              // too many diff
              if (propertyDiffCount > maxDiffPerObject) {
                skippedCounters.total++;
                skippedCounters.diff += propertyNode.diff.counters.overall.any;
                continue;
              }
              // first write property eventually skipped
              const propertyWithoutDiffSkippedCount =
                propertyWithoutDiffSkippedArray.length;
              if (propertyWithoutDiffSkippedCount) {
                if (propertyWithoutDiffSkippedCount > maxPropertyAbove) {
                  const previousPropertyToDisplayArray =
                    propertyWithoutDiffSkippedArray.slice(
                      -(maxPropertyAbove - 1),
                    );
                  const propertyAboveCount =
                    propertyWithoutDiffSkippedCount - 1;
                  const arrowSign = propertyDiffCount > 1 ? `↕` : `↑`;
                  compositeBody += `${indent}  `;
                  compositeBody += ANSI.color(
                    `${arrowSign} ${propertyAboveCount} props ${arrowSign}`,
                    delimitersColor,
                  );
                  skippedCounters.total -= propertyAboveCount;
                  compositeBody += "\n";
                  for (const previousPropertyToDisplay of previousPropertyToDisplayArray) {
                    skippedCounters.total--;
                    writePropertyDiff(previousPropertyToDisplay);
                  }
                } else {
                  for (const previousPropertyToDisplay of propertyWithoutDiffSkippedArray) {
                    skippedCounters.total--;
                    writePropertyDiff(previousPropertyToDisplay);
                  }
                }
                propertyWithoutDiffSkippedArray.length = 0;
              }
              writePropertyDiff(property);
              continue;
            }
            skippedCounters.total++;
            propertyWithoutDiffSkippedArray.push(property);
            // property does not have a diff
            // maybe it should be skipped
          }

          let belowSummary = "";
          // now display the property below
          const propertyWithoutDiffSkippedCount =
            propertyWithoutDiffSkippedArray.length;
          if (propertyWithoutDiffSkippedCount) {
            if (propertyWithoutDiffSkippedCount > maxPropertyBelow) {
              const nextPropertyToDisplayArray =
                propertyWithoutDiffSkippedArray.slice(0, maxPropertyBelow - 1);
              for (const nextPropertyToDisplay of nextPropertyToDisplayArray) {
                skippedCounters.total--;
                writePropertyDiff(nextPropertyToDisplay);
              }
            } else {
              for (const nextPropertyToDisplay of propertyWithoutDiffSkippedArray) {
                skippedCounters.total--;
                writePropertyDiff(nextPropertyToDisplay);
              }
            }
          }
          if (skippedCounters.total) {
            belowSummary += ANSI.color(
              skippedCounters.total === 1
                ? `1 prop`
                : `${skippedCounters.total} props`,
              delimitersColor,
            );
          }
          if (skippedCounters.diff) {
            if (belowSummary.length) {
              belowSummary += " ";
            }
            belowSummary += ANSI.color(
              `${removedSign}${skippedCounters.diff}`,
              colorForUnexpected,
            );
          }
          if (belowSummary) {
            compositeBody += `${indent}  `;
            compositeBody += ANSI.color(`↓`, delimitersColor);
            compositeBody += " ";
            compositeBody += belowSummary;
            compositeBody += " ";
            compositeBody += ANSI.color(`↓`, delimitersColor);
            compositeBody += "\n";
          }

          if (signs) {
            if (mode === "removed") {
              compositeBody += ANSI.color(removedSign, removedSignColor);
              indent = indent.slice(1);
            } else if (mode === "added") {
              compositeBody += ANSI.color(addedSign, addedSignColor);
              indent = indent.slice(1);
            }
          }
          compositeBody += indent;
        }
      }
      compositeDiff += compositePrefix;
      compositeDiff += compositeBody;
      compositeDiff += compositeSuffix;
      return compositeDiff;
    };
    const writeDiff = (node, context) => {
      const method =
        node.type === "property_descriptor"
          ? writePropertyDescriptorDiff
          : writeValueDiff;

      if (node.diff.removed) {
        return method(node, {
          ...context,
          mode: "removed",
        });
      }
      if (node.diff.added) {
        return method(node, {
          ...context,
          mode: "added",
        });
      }
      if (node.diff.identity) {
        if (node === rootComparison) {
          signs = false;
        }
        let identityDiff = "";
        identityDiff += method(node, {
          ...context,
          mode: "removed",
        });
        if (node.type !== "property_descriptor") {
          identityDiff += "\n";
        }
        identityDiff += method(node, {
          ...context,
          mode: "added",
        });
        return identityDiff;
      }
      return method(node, {
        ...context,
        mode: "traverse",
      });
    };

    let diffMessage = writeDiff(startNode, {});

    let message;
    if (rootComparison.diff.identity) {
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
      before: {
        value: beforeValue,
        valueOf: () => {
          throw new Error("use before.value");
        },
        isComposite: isComposite(beforeValue),
        isPrimitive: isPrimitive(beforeValue),
        reference: undefined,
        referenceId: null,
        referenceFromOthersSet: new Set(),
      },
      after: {
        value: afterValue,
        valueOf: () => {
          throw new Error("use after.value");
        },
        isComposite: isComposite(afterValue),
        isPrimitive: isPrimitive(afterValue),
        reference: undefined,
        referenceId: null,
        referenceFromOthersSet: new Set(),
      },
      properties: {},
      diff: {
        counters: {
          overall: {
            any: 0,
            removal: 0,
            addition: 0,
          },
          self: {
            any: 0,
            removal: 0,
            addition: 0,
          },
          inside: {
            any: 0,
            removal: 0,
            addition: 0,
          },
        },
        identity: null,
        reference: null,
        properties: {},
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

const isComposite = (value) => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};

const isPrimitive = (value) => {
  return !isComposite(value);
};
