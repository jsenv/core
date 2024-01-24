import { isAssertionError, createAssertionError } from "./assertion_error.js";
import { ANSI } from "@jsenv/humanize";

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
    const { actual, expected } = firstArg;

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

    let diff = "";
    let signs = true;
    let refId = 1;
    let startNode = rootComparison;
    // if the first diff is too deep
    // we'll start, not from the rootComparison, but from a deeper node
    const [firstNodeWithADiff] = nodesWithDiffArray;
    const nodeDiffHandledSet = new Set();
    const maxDepth = 5;
    if (firstNodeWithADiff.depth > maxDepth) {
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
      diff += ANSI.color(property, color);
    };
    const writePropertyDiff = (node, { property, descriptorName, mode }) => {
      if (mode !== "traverse") {
        nodeDiffHandledSet.add(node);
      }

      let indent = `  `.repeat(node.depth - startNode.depth);
      let keyColor;
      let delimitersColor;
      let diffMode;

      if (mode === "removed") {
        diffMode = "removed";
        if (signs) {
          diff += ANSI.color("-", ANSI.RED);
          indent = indent.slice(1);
        }
        keyColor = delimitersColor = ANSI.RED;
      }
      if (mode === "added") {
        diffMode = "added";
        if (signs) {
          diff += ANSI.color("+", ANSI.GREEN);
          indent = indent.slice(1);
        }
        keyColor = delimitersColor = ANSI.GREEN;
      }
      if (mode === "value_removed") {
        diffMode = "removed";
        diff += ANSI.color("-", ANSI.RED);
        indent = indent.slice(1);
        keyColor = delimitersColor = ANSI.GREY;
      }
      if (mode === "value_added") {
        diffMode = "added";
        diff += ANSI.color("+", ANSI.GREEN);
        indent = indent.slice(1);
        keyColor = delimitersColor = ANSI.GREY;
      }
      if (mode === "traverse") {
        diffMode = "traverse";
        keyColor = delimitersColor = ANSI.GREY;
      }

      diff += indent;
      if (descriptorName !== "value") {
        diff += ANSI.color(descriptorName, keyColor);
        diff += " ";
      }
      writePropertyKey(property, keyColor);
      diff += ANSI.color(":", delimitersColor);
      diff += " ";
      writeValueDiff(node, diffMode);
      diff += ANSI.color(",", delimitersColor);
      diff += "\n";
      return;
    };
    const writePropertyDescriptorDiff = (
      node,
      { property, descriptorName },
    ) => {
      if (node.diff.removed) {
        if (!isDefaultDescriptor(descriptorName, node.before.value)) {
          writePropertyDiff(node, {
            property,
            descriptorName,
            mode: "removed",
          });
        }
        return;
      }
      if (node.diff.added) {
        if (!isDefaultDescriptor(descriptorName, node.after.value)) {
          writePropertyDiff(node, {
            property,
            descriptorName,
            mode: "added",
          });
        }
        return;
      }
      if (node.diff.identity) {
        writePropertyDiff(node, {
          property,
          descriptorName,
          mode: "value_removed",
        });
        writePropertyDiff(node, {
          property,
          descriptorName,
          mode: "value_added",
        });
        return;
      }
      if (!isDefaultDescriptor(descriptorName, node.before.value)) {
        writePropertyDiff(node, {
          property,
          descriptorName,
          mode: "traverse",
        });
      }
    };
    const writeValueDiff = (node, mode) => {
      if (mode !== "traverse") {
        nodeDiffHandledSet.add(node);
      }
      const valueInfo = mode === "added" ? node.after : node.before;
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
        diff += ANSI.color(JSON.stringify(valueInfo.value), valueColor);
        return;
      }
      if (valueInfo.reference) {
        diff += ANSI.color(`<ref #${valueInfo.referenceId}>`, delimitersColor);
        return;
      }
      if (valueInfo.referenceFromOthersSet.size) {
        diff += ANSI.color(`<ref #${refId}>`, delimitersColor);
        diff += " ";
      }
      diff += ANSI.color("{", delimitersColor);
      properties_diff: {
        const propertyNames = Object.keys(node.properties);
        if (propertyNames.length) {
          diff += "\n";
        }
        for (const property of propertyNames) {
          const propertyNode = node.properties[property];
          const descriptorNames = Object.keys(propertyNode.descriptors);
          for (const descriptorName of descriptorNames) {
            const descriptorNode = propertyNode.descriptors[descriptorName];
            writePropertyDescriptorDiff(descriptorNode, {
              property,
              descriptorName,
            });
          }
        }
      }
      diff += "  ".repeat(node.depth - startNode.depth);
      diff += ANSI.color("}", delimitersColor);
    };
    const writeDiff = (node) => {
      if (node.diff.removed) {
        writeValueDiff(node, "removed");
        return;
      }
      if (node.diff.added) {
        writeValueDiff(node, "added");
        return;
      }
      if (node.diff.identity) {
        if (node === rootComparison) {
          signs = false;
        }
        writeValueDiff(node, "removed");
        diff += "\n";
        writeValueDiff(node, "added");
        return;
      }
      writeValueDiff(node, "traverse");
    };

    if (startNode === rootComparison) {
      writeDiff(startNode);
    } else {
      diff += `${startNode.path}:`;
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
    const diffNotHandled = nodesWithDiffArray.length - nodeDiffHandledSet.size;
    if (diffNotHandled > 0) {
      message += "\n";
      message += "(";
      message += `${nodeDiffHandledSet.size} displayed below and `;
      message += ANSI.color(`${diffNotHandled} truncated`, ANSI.YELLOW);
      message += ")";
    }
    message += `\n\n`;
    message += `${diff}`;

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
