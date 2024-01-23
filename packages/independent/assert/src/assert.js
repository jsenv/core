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
    const createComparisonNode = ({ type, before, after, parent, depth }) => {
      const node = {
        type,
        before,
        after,
        parent,
        depth,
        properties: {},
        appendProperty: (property, { before, after }) => {
          const propertyNode = createComparisonNode({
            type: "property",
            before,
            after,
            parent: node,
            depth: depth + 1,
          });
          node.properties[property] = propertyNode;
          return propertyNode;
        },
        descriptors: {},
        appendPropertyDescriptor: (name, { before, after }) => {
          const propertyDescriptorNode = createComparisonNode({
            type: "property_descriptor",
            before,
            after,
            parent: node,
            depth: depth + 1,
          });
          node.descriptors[name] = propertyDescriptorNode;
          return propertyDescriptorNode;
        },
        // entries: [],
      };
      return node;
    };
    const rootNode = createComparisonNode({
      type: "root",
      before: expected,
      after: actual,
      depth: 0,
    });

    const visit = (node) => {
      const { before, after } = node;
      node.diff = {
        count: 0,
      };

      identity: {
        if (isPrimitive(before) || isPrimitive(after)) {
          if (before !== after) {
            node.diff.identity = true;
            node.diff.count++;
          }
        }
      }
      properties: {
        // here we want to traverse before and after but if they are not composite
        // we'll consider everything as removed or added, depending the scenario

        node.diff.properties = {};

        const beforeIsComposite = isComposite(before);
        const afterIsComposite = isComposite(after);
        const visitProperty = (property) => {
          const beforePropertyDescriptor = beforeIsComposite
            ? Object.getOwnPropertyDescriptor(before, property)
            : null;
          const afterPropertyDescriptor = afterIsComposite
            ? Object.getOwnPropertyDescriptor(after, property)
            : null;
          const propertyNode = node.appendProperty(property, {
            before: beforePropertyDescriptor,
            after: afterPropertyDescriptor,
          });
          propertyNode.diff = {
            count: 0,
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

          const added = !beforePropertyDescriptor;
          const removed = !afterPropertyDescriptor;

          if (added) {
            propertyNode.diff.added = true;
            propertyNode.diff.count++;
          }
          if (removed) {
            propertyNode.diff.removed = true;
            propertyNode.diff.count++;
          }

          const visitPropertyDescriptor = (descriptorName) => {
            const descriptorNode = propertyNode.appendPropertyDescriptor(
              descriptorName,
              {
                before: added
                  ? undefined
                  : beforePropertyDescriptor[descriptorName],
                after: removed
                  ? undefined
                  : afterPropertyDescriptor[descriptorName],
              },
            );
            visit(descriptorNode);
            if (added) {
              descriptorNode.diff.added = true;
              descriptorNode.diff.count++;
            } else if (removed) {
              descriptorNode.diff.removed = true;
              descriptorNode.diff.count++;
            } else {
              propertyNode.diff.value = descriptorNode.diff;
              propertyNode.diff.count += descriptorNode.diff.count;
            }
          };

          visitPropertyDescriptor("value");
          visitPropertyDescriptor("enumerable");
          visitPropertyDescriptor("writable");
          visitPropertyDescriptor("configurable");
          visitPropertyDescriptor("set");
          visitPropertyDescriptor("get");
          node.diff.count += propertyNode.diff.count;
        };

        if (beforeIsComposite) {
          const beforePropertyNames = Object.getOwnPropertyNames(before);
          for (const beforePropertyName of beforePropertyNames) {
            visitProperty(beforePropertyName);
          }
        }
        if (afterIsComposite) {
          const afterPropertyNames = Object.getOwnPropertyNames(after);
          for (const afterPropertyName of afterPropertyNames) {
            if (node.properties[afterPropertyName]) {
              // already visited
              continue;
            }
            visitProperty(afterPropertyName);
          }
        }
      }
    };
    visit(rootNode);

    if (rootNode.diff.count === 0) {
      return;
    }

    const stringifyPropertyKey = (property) => {
      // todo: handle property that must be between quotes,
      // handle symbols
      return property;
    };

    let message;
    if (rootNode.diff.identity) {
      message = `${ANSI.color("expected", ANSI.RED)} and ${ANSI.color("actual", ANSI.GREEN)} are different:`;
    } else {
      message = `${ANSI.color("expected", ANSI.RED)} and ${ANSI.color("actual", ANSI.GREEN)} have ${rootNode.diff.count} ${rootNode.diff.count === 1 ? "difference" : "differences"}:`;
    }

    let diff = "";
    let signs = true;
    const writePropertyDescriptorDiff = (
      node,
      { property, descriptorName, propertyDiffMode = "" },
    ) => {
      const writePropertyDiff = (mode) => {
        let indent = `  `.repeat(node.parent.depth);
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
        diff += ANSI.color(stringifyPropertyKey(property), keyColor);
        diff += ANSI.color(":", delimitersColor);
        diff += " ";
        writeDiff(node, { signs, diffMode });
        diff += ANSI.color(",", delimitersColor);
        diff += "\n";
        return;
      };

      if (propertyDiffMode !== "") {
        writePropertyDiff(propertyDiffMode);
        return;
      }
      if (node.diff.removed) {
        if (!isDefaultDescriptor(descriptorName, node.before)) {
          writePropertyDiff("removed");
        }
        return;
      }
      if (node.diff.added) {
        if (!isDefaultDescriptor(descriptorName, node.after)) {
          writePropertyDiff("added");
        }
        return;
      }
      if (node.diff.identity) {
        writePropertyDiff("value_removed");
        writePropertyDiff("value_added");
        return;
      }
      if (!isDefaultDescriptor(descriptorName, node.before)) {
        writePropertyDiff("traverse");
      }
    };
    const writeDiff = (node, diffMode = "") => {
      const writeValueDiff = (mode) => {
        const value = mode === "added" ? node.after : node.before;
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

        if (isPrimitive(value)) {
          diff += ANSI.color(JSON.stringify(value), valueColor);
          return;
        }

        diff += ANSI.color("{", delimitersColor);
        properties_diff: {
          const propertyNames = Object.keys(node.properties);
          if (propertyNames.length) {
            diff += "\n";
            diff += "  ".repeat(node.depth);
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
        diff += ANSI.color("}", delimitersColor);
      };

      if (diffMode !== "") {
        writeValueDiff(diffMode);
        return;
      }
      if (node.diff.removed) {
        writeValueDiff("removed");
        return;
      }
      if (node.diff.added) {
        writeValueDiff("added");
        return;
      }
      if (node.diff.identity) {
        if (node === rootNode) {
          signs = false;
        }
        writeValueDiff("removed");
        diff += "\n";
        writeValueDiff("added");
        return;
      }
      writeValueDiff("traverse");
    };
    writeDiff(rootNode);

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

const isComposite = (value) => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};

const isPrimitive = (value) => {
  return !isComposite(value);
};
