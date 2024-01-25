import stringWidth from "string-width";
import { ANSI } from "@jsenv/humanize";
import { isAssertionError, createAssertionError } from "./assertion_error.js";

export const createAssert = ({ format = (v) => v } = {}) => {
  const assert = (...args) => {
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
    const firstArg = args[0];
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
    const { actual, expected, maxDepth = 5, maxColumns = 100 } = firstArg;

    const comparisonTree = createComparisonTree(expected, actual);
    const rootComparison = comparisonTree.root;
    const nodesWithDiffArray = [];

    const visit = (node) => {
      identity: {
        if (node.before.isPrimitive || node.after.isPrimitive) {
          if (node.before.value !== node.after.value) {
            node.diff.identity = true;
            node.diff.counters.self++;
            node.diff.counters.total++;
          }
        }
      }
      reference: {
        if (node.before.reference !== node.after.reference) {
          node.diff.reference = true;
          node.diff.counters.self++;
          node.diff.counters.total++;
        }
      }
      properties: {
        // here we want to traverse before and after but if they are not composite
        // we'll consider everything as removed or added, depending the scenario
        const visitProperty = (property) => {
          const beforePropertyDescriptor = node.before.isComposite
            ? Object.getOwnPropertyDescriptor(node.before.value, property)
            : null;
          const afterPropertyDescriptor = node.after.isComposite
            ? Object.getOwnPropertyDescriptor(node.after.value, property)
            : null;
          const propertyNode = node.appendProperty(property, {
            beforeValue: beforePropertyDescriptor,
            afterValue: afterPropertyDescriptor,
          });

          const added = !beforePropertyDescriptor;
          const removed = !afterPropertyDescriptor;

          if (added) {
            propertyNode.diff.added = true;
            propertyNode.diff.counters.self++;
          }
          if (removed) {
            propertyNode.diff.removed = true;
            propertyNode.diff.counters.self++;
          }

          const visitPropertyDescriptor = (descriptorName) => {
            const descriptorNode = propertyNode.appendPropertyDescriptor(
              descriptorName,
              {
                beforeValue: added
                  ? undefined
                  : beforePropertyDescriptor[descriptorName],
                afterValue: removed
                  ? undefined
                  : afterPropertyDescriptor[descriptorName],
              },
            );
            visit(descriptorNode);
            if (added) {
              descriptorNode.diff.added = true;
              descriptorNode.diff.counters.self++;
              descriptorNode.diff.counters.total++;
            } else if (removed) {
              descriptorNode.diff.removed = true;
              descriptorNode.diff.counters.self++;
              descriptorNode.diff.counters.total++;
            } else {
              propertyNode.diff.value = descriptorNode.diff;
              propertyNode.diff.counters.self +=
                descriptorNode.diff.counters.self;
              propertyNode.diff.counters.total +=
                descriptorNode.diff.counters.total;
            }
          };

          visitPropertyDescriptor("value");
          visitPropertyDescriptor("enumerable");
          visitPropertyDescriptor("writable");
          visitPropertyDescriptor("configurable");
          visitPropertyDescriptor("set");
          visitPropertyDescriptor("get");
          node.diff.counters.total += propertyNode.diff.counters.total;
        };
        if (
          node.before.isComposite &&
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
          node.after.isComposite &&
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

      if (node.diff.counters.self) {
        nodesWithDiffArray.push(node);
      }
    };
    visit(rootComparison);

    if (nodesWithDiffArray.length === 0) {
      return;
    }

    let signs = true;
    let refId = 1;
    let startNode = rootComparison;
    // if the first diff is too deep
    // we'll start, not from the rootComparison, but from a deeper node
    const firstNodeWithADiff =
      nodesWithDiffArray[nodesWithDiffArray.length - 1];
    const nodeDiffHandledSet = new Set();
    if (firstNodeWithADiff.depth >= maxDepth) {
      const nodesFromRootToTarget = [firstNodeWithADiff];
      let currentNode = firstNodeWithADiff;
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
      let startNodeDepth = firstNodeWithADiff.depth - maxDepth;
      let path = "";
      for (const node of nodesFromRootToTarget) {
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
        node.path = path;
        if (
          startNode === rootComparison &&
          node.type === "property_descriptor" &&
          node.depth === startNodeDepth
        ) {
          startNode = node;
          break;
        }
      }
    }

    const writePropertyKey = (property, color) => {
      // todo: handle property that must be between quotes,
      // handle symbols
      return ANSI.color(property, color);
    };
    const writePropertyDiff = (node, { property, descriptorName, mode }) => {
      let propertyDiff = "";
      if (mode !== "traverse") {
        nodeDiffHandledSet.add(node);
      }
      const relativeDepth = node.depth - startNode.depth;
      let indent = `  `.repeat(relativeDepth);
      let keyColor;
      let delimitersColor;
      let diffMode;

      if (mode === "removed") {
        diffMode = "removed";
        if (signs) {
          propertyDiff += ANSI.color("-", ANSI.RED);
          indent = indent.slice(1);
        }
        keyColor = delimitersColor = ANSI.RED;
      }
      if (mode === "added") {
        diffMode = "added";
        if (signs) {
          propertyDiff += ANSI.color("+", ANSI.GREEN);
          indent = indent.slice(1);
        }
        keyColor = delimitersColor = ANSI.GREEN;
      }
      if (mode === "value_removed") {
        diffMode = "removed";
        propertyDiff += ANSI.color("-", ANSI.RED);
        indent = indent.slice(1);
        keyColor = delimitersColor = ANSI.GREY;
      }
      if (mode === "value_added") {
        diffMode = "added";
        propertyDiff += ANSI.color("+", ANSI.GREEN);
        indent = indent.slice(1);
        keyColor = delimitersColor = ANSI.GREY;
      }
      if (mode === "traverse") {
        diffMode = "traverse";
        keyColor = delimitersColor = ANSI.GREY;
      }

      propertyDiff += indent;
      if (descriptorName !== "value") {
        propertyDiff += ANSI.color(descriptorName, keyColor);
        propertyDiff += " ";
      }
      const propertyKeyFormatted = writePropertyKey(property, keyColor);
      propertyDiff += propertyKeyFormatted;
      propertyDiff += ANSI.color(":", delimitersColor);
      propertyDiff += " ";
      const valueDiff = writeValueDiff(node, {
        mode: diffMode,
        maxWidth: maxColumns - stringWidth(propertyDiff) - ",".length,
      });
      propertyDiff += valueDiff;
      propertyDiff += ANSI.color(",", delimitersColor);
      propertyDiff += "\n";
      return propertyDiff;
    };
    const writePropertyDescriptorDiff = (
      node,
      { property, descriptorName },
    ) => {
      if (node.diff.removed) {
        if (!isDefaultDescriptor(descriptorName, node.before.value)) {
          return writePropertyDiff(node, {
            property,
            descriptorName,
            mode: "removed",
          });
        }
        return "";
      }
      if (node.diff.added) {
        if (!isDefaultDescriptor(descriptorName, node.after.value)) {
          return writePropertyDiff(node, {
            property,
            descriptorName,
            mode: "added",
          });
        }
        return "";
      }
      if (node.diff.identity) {
        let descriptorDiff = "";
        descriptorDiff += writePropertyDiff(node, {
          property,
          descriptorName,
          mode: "value_removed",
        });
        descriptorDiff += writePropertyDiff(node, {
          property,
          descriptorName,
          mode: "value_added",
        });
        return descriptorDiff;
      }
      if (isDefaultDescriptor(descriptorName, node.before.value)) {
        return "";
      }
      return writePropertyDiff(node, {
        property,
        descriptorName,
        mode: "traverse",
      });
    };
    const writeValueDiff = (node, { mode, maxWidth, collapsed }) => {
      if (mode !== "traverse") {
        nodeDiffHandledSet.add(node);
      }
      const valueName = mode === "added" ? "after" : "before";
      const valueInfo = node[valueName];
      const valueColor =
        mode === "removed"
          ? ANSI.RED
          : mode === "added"
            ? ANSI.GREEN
            : ANSI.GREY;
      const delimitersColor =
        mode === "removed"
          ? ANSI.RED
          : mode === "added"
            ? ANSI.GREEN
            : ANSI.GREY;

      if (valueInfo.isPrimitive) {
        const value = valueInfo.value;
        let valueDiff = JSON.stringify(value);
        if (valueDiff.length > maxWidth) {
          valueDiff = valueDiff.slice(0, maxWidth);
          valueDiff += "…";
        }
        return ANSI.color(valueDiff, valueColor);
      }

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
        if (collapsed === undefined) {
          collapsed =
            relativeDepth >= maxDepth || node.diff.counters.total === 0;
        }
        if (collapsed) {
          if (propertiesOverview) {
            let propertiesDiff = "";
            let propertyDisplayedCount = 0;
            let lineWidth = "{  }".length;
            const remainingEstimatedLength = `...${propertyCount} props`.length;
            for (const property of propertyNames) {
              let propertyDiff = "";
              const propertyNode = node.properties[property];
              if (propertiesDiff.length === 0) {
                propertyDiff += " ";
              } else {
                propertyDiff += ", ";
              }
              propertyDiff += writePropertyKey(property);
              propertyDiff += ": ";

              if (
                propertyNode.descriptors.get[valueName].value &&
                propertyNode.descriptors.set[valueName].value
              ) {
                propertyDiff += `[get/set]`;
              } else if (propertyNode.descriptors.get[valueName].value) {
                propertyDiff += `[get]`;
              } else if (propertyNode.descriptors.set[valueName].value) {
                propertyDiff += `[set]`;
              } else {
                propertyDiff += writeValueDiff(propertyNode.descriptors.value, {
                  mode,
                  collapsed: true,
                });
              }
              lineWidth += stringWidth(propertyDiff);
              if (lineWidth + remainingEstimatedLength > maxWidth) {
                const remainingProperties =
                  propertyCount - propertyDisplayedCount;
                if (remainingProperties) {
                  propertiesDiff += `...${remainingProperties} props`;
                }
                break;
              }
              propertiesDiff += propertyDiff;
              propertyDisplayedCount++;
            }
            compositeBody += propertiesDiff;
            compositeBody += " ";
          } else {
            compositePrefix = "Object(";
            compositeSuffix = ")";
            compositeBody += `${propertyCount}`;
          }
        } else {
          compositeBody += "\n";
          for (const property of propertyNames) {
            const propertyNode = node.properties[property];
            const descriptorNames = Object.keys(propertyNode.descriptors);
            for (const descriptorName of descriptorNames) {
              const descriptorNode = propertyNode.descriptors[descriptorName];
              compositeBody += writePropertyDescriptorDiff(descriptorNode, {
                property,
                descriptorName,
              });
            }
          }
          compositeBody += "  ".repeat(relativeDepth);
        }
      }
      compositeDiff += compositePrefix;
      compositeDiff += compositeBody;
      compositeDiff += compositeSuffix;
      return compositeDiff;
    };
    const writeDiff = (node) => {
      if (node.diff.removed) {
        return writeValueDiff(node, { mode: "removed" });
      }
      if (node.diff.added) {
        return writeValueDiff(node, { mode: "added" });
      }
      if (node.diff.identity) {
        if (node === rootComparison) {
          signs = false;
        }
        let identityDiff = "";
        identityDiff += writeValueDiff(node, { mode: "removed" });
        identityDiff += "\n";
        identityDiff += writeValueDiff(node, { mode: "added" });
        return identityDiff;
      }
      return writeValueDiff(node, { mode: "traverse" });
    };

    let diff;
    if (startNode === rootComparison) {
      diff = writeDiff(startNode);
    } else {
      diff = `${startNode.path}:`;
      diff += "\n";
      writeDiff(startNode);
    }

    let message;
    if (rootComparison.diff.identity) {
      message = `${ANSI.color("expected", ANSI.RED)} and ${ANSI.color("actual", ANSI.GREEN)} are different`;
    } else {
      message = `${ANSI.color("expected", ANSI.RED)} and ${ANSI.color("actual", ANSI.GREEN)} have ${rootComparison.diff.counters.total} ${rootComparison.diff.counters.total === 1 ? "difference" : "differences"}`;
    }
    message += ":";
    message += `\n\n`;
    message += `${diff}`;
    const diffNotHandled = nodesWithDiffArray.length - nodeDiffHandledSet.size;
    if (diffNotHandled > 0) {
      message += "\n";
      message += `To improve readability the rest of the diff is not displayed`;
    }

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
        reference: null,
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
        reference: null,
        referenceId: null,
        referenceFromOthersSet: new Set(),
      },
      diff: {
        counters: {
          self: 0,
          total: 0,
        },
        identity: null,
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
      node.diff.reference = null;

      node.properties = {};
      node.diff.properties = {};
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
          counters: {
            self: 0,
            total: 0,
          },
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

        propertyNode.descriptors = {};
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
