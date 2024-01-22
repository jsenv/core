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
        if (!isComposite(before) || !isComposite(actual)) {
          break properties;
        }
        node.diff.properties = {};
        const visitProperty = (property) => {
          const beforePropertyDescriptor = Object.getOwnPropertyDescriptor(
            before,
            property,
          );
          const afterPropertyDescriptor = Object.getOwnPropertyDescriptor(
            after,
            property,
          );
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
        // for simplicity now let's assume both are objects
        // with same prototypes and we'll compare only the property value)
        const beforePropertyNames = Object.getOwnPropertyNames(before);
        for (const beforePropertyName of beforePropertyNames) {
          visitProperty(beforePropertyName);
        }
        const afterPropertyNames = Object.getOwnPropertyNames(actual);
        for (const afterPropertyName of afterPropertyNames) {
          if (!beforePropertyNames.includes(afterPropertyName)) {
            visitProperty(afterPropertyName);
          }
        }
      }
    };
    visit(rootNode);

    if (rootNode.diff.count === 0) {
      return;
    }

    const stringifyPrimitive = (value) => {
      // TODO: use the same stringification method as the one
      // used while traversing expected
      return JSON.stringify(value);
    };
    const stringifyComposite = (value) => {
      // TODO: use the same stringification method as the one
      // used while traversing expected
      return JSON.stringify(value);
    };
    const stringify = (value) => {
      return isPrimitive(value)
        ? stringifyPrimitive(value)
        : stringifyComposite(value);
    };
    const stringifyPropertyKey = (property) => {
      // todo: handle property that must be between quotes,
      // handle symbols
      return property;
    };

    let message;
    if (rootNode.diff.identity) {
      message = `${ANSI.color("expected", ANSI.RED)} and ${ANSI.color("actual", ANSI.GREEN)} are different:`;
      message += `\n\n`;
      message += ANSI.color(stringify(rootNode.before), ANSI.RED);
      message += `\n`;
      message += ANSI.color(stringify(rootNode.after), ANSI.GREEN);
    } else {
      message = `${ANSI.color("expected", ANSI.RED)} and ${ANSI.color("actual", ANSI.GREEN)} have ${rootNode.diff.count} ${rootNode.diff.count === 1 ? "difference" : "differences"}:`;
      message += `\n\n`;
      let diff = "";

      const writePropertyDescriptorDiff = (
        node,
        { property, descriptorName },
      ) => {
        const writePropertyLine = ({ type }) => {
          let indent = `  `.repeat(node.parent.depth);
          let value;
          let keyColor;
          let delimitersColor;
          let valueColor;
          if (type === "removed") {
            value = node.before;
            diff += ANSI.color("-", ANSI.RED);
            indent = indent.slice(1);
            keyColor = delimitersColor = valueColor = ANSI.RED;
          }
          if (type === "added") {
            value = node.after;
            diff += ANSI.color("+", ANSI.GREEN);
            indent = indent.slice(1);
            keyColor = delimitersColor = valueColor = ANSI.GREEN;
          }
          if (type === "value_modified_before") {
            value = node.before;
            diff += ANSI.color("-", ANSI.RED);
            indent = indent.slice(1);
            keyColor = delimitersColor = ANSI.GREY;
            valueColor = ANSI.RED;
          }
          if (type === "value_modified_after") {
            value = node.after;
            diff += ANSI.color("+", ANSI.GREEN);
            indent = indent.slice(1);
            keyColor = delimitersColor = ANSI.GREY;
            valueColor = ANSI.GREEN;
          }
          if (type === "same") {
            value = node.after;
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
          if (type === "same") {
            writeDiff(node);
          } else {
            diff += ANSI.color(JSON.stringify(value), valueColor);
          }
          diff += ANSI.color(",", delimitersColor);
          diff += "\n";

          return;
        };

        if (node.diff.removed) {
          if (isDefaultDescriptor(descriptorName, node.before)) {
            return;
          }
          writePropertyLine({
            type: "removed",
          });
          return;
        }
        if (node.diff.added) {
          if (isDefaultDescriptor(descriptorName, node.after)) {
            return;
          }
          writePropertyLine({
            type: "added",
          });
          return;
        }
        if (node.diff.identity) {
          writePropertyLine({
            type: "value_modified_before",
          });
          writePropertyLine({
            type: "value_modified_after",
          });
          return;
        }
        if (isDefaultDescriptor(descriptorName, node.before)) {
          return;
        }
        writePropertyLine({
          type: "same",
        });
      };
      const writeDiff = (node) => {
        writeCompositeDiff(node);
      };
      const writeCompositeDiff = (node) => {
        diff += ANSI.color("{", ANSI.GREY);
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
        diff += ANSI.color("}", ANSI.GREY);
      };
      writeCompositeDiff(rootNode);

      message += `${diff}`;
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

const isComposite = (value) => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};

const isPrimitive = (value) => {
  return !isComposite(value);
};
