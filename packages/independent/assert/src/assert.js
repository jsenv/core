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

    const visitForDiff = (node, { property, descriptorName } = {}) => {
      const generatePropertyLine = ({ descriptorValue, colors = {} }) => {
        let propertyLine = "";
        propertyLine += `  `.repeat(node.parent.depth);
        if (descriptorName !== "value") {
          propertyLine += ANSI.color(descriptorName, colors.key);
          propertyLine += " ";
        }
        propertyLine += ANSI.color(stringifyPropertyKey(property), colors.key);
        propertyLine += ANSI.color(":", colors.delimiters);
        propertyLine += " ";
        propertyLine += ANSI.color(stringify(descriptorValue), colors.value);
        propertyLine += ANSI.color(",", colors.delimiters);
        propertyLine += "\n";
        return propertyLine;
      };

      let diff = "";
      if (node.diff.identity) {
        diff += ANSI.color("-", ANSI.RED);
        diff += generatePropertyLine({
          descriptorValue: node.before,
          colors: {
            key: ANSI.GREY,
            delimiters: ANSI.GREY,
            value: ANSI.RED,
          },
        }).slice(1);
        diff += ANSI.color("+", ANSI.GREEN);
        diff += generatePropertyLine({
          descriptorValue: node.after,
          colors: {
            key: ANSI.GREY,
            delimiters: ANSI.GREY,
            value: ANSI.GREEN,
          },
        }).slice(1);
        return diff;
      }

      if (isComposite(node.before)) {
        let compositeDiff = "";
        compositeDiff += ANSI.color("{", ANSI.GREY);
        properties_diff: {
          let propertiesDiff = "";
          const propertyNames = Object.keys(node.properties);
          for (const property of propertyNames) {
            let propertyDiff = "";
            const propertyNode = node.properties[property];
            const descriptorNames = Object.keys(propertyNode.descriptors);
            for (const descriptorName of descriptorNames) {
              const descriptorNode = propertyNode.descriptors[descriptorName];
              // if (descriptorNode.diff.count === 0) {
              //   if (isDefaultDescriptor(descriptorName, descriptorNode.before)) {
              //     continue;
              //   }
              //   let descriptorWithoutDiff = visitOneDescriptorForDiff({
              //     propertyNode,
              //     property,
              //     descriptorName,
              //     descriptorValue: descriptorNode.before,
              //   });
              //   descriptorWithoutDiff = ANSI.color(
              //     descriptorWithoutDiff,
              //     ANSI.GREY,
              //   );
              //   propertyDiff += descriptorWithoutDiff;
              //   continue;
              // }
              // if (descriptorNode.diff.removed) {
              //   if (isDefaultDescriptor(descriptorName, descriptorNode.before)) {
              //     continue;
              //   }
              //   let descriptorRemovedDiff = "";
              //   descriptorRemovedDiff += `-`;
              //   descriptorRemovedDiff += visitOneDescriptorForDiff({
              //     propertyNode,
              //     property,
              //     descriptorName,
              //     descriptorValue: descriptorNode.before,
              //   });
              //   descriptorRemovedDiff = ANSI.color(
              //     descriptorRemovedDiff,
              //     ANSI.RED,
              //   );
              //   propertyDiff += descriptorRemovedDiff;
              //   continue;
              // }
              // if (descriptorNode.diff.added) {
              //   if (isDefaultDescriptor(descriptorName, descriptorNode.after)) {
              //     return "";
              //   }
              //   let descriptorAddedDiff = "";
              //   descriptorAddedDiff += "+";
              //   descriptorAddedDiff += visitOneDescriptorForDiff({
              //     propertyNode,
              //     property,
              //     descriptorName,
              //     descriptorValue: descriptorNode.after,
              //   });
              //   descriptorAddedDiff = ANSI.color(descriptorAddedDiff, ANSI.GREEN);
              //   propertyDiff += descriptorAddedDiff;
              //   continue;
              // }
              let descriptorDiff = "";
              descriptorDiff += visitForDiff(descriptorNode, {
                property,
                descriptorName,
              });
              propertyDiff += descriptorDiff;
            }
            propertiesDiff += propertyDiff;
          }
          if (propertiesDiff.length) {
            compositeDiff += "\n";
            compositeDiff += propertiesDiff;
          }
        }
        compositeDiff += ANSI.color("}", ANSI.GREY);
        return compositeDiff;
      }

      return "";
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
      const diff = visitForDiff(rootNode);
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

const isComposite = (value) => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};

const isPrimitive = (value) => {
  return !isComposite(value);
};
