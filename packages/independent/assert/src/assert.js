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
        const visitProperty = (name) => {
          const beforePropertyDescriptor = Object.getOwnPropertyDescriptor(
            before,
            name,
          );
          const afterPropertyDescriptor = Object.getOwnPropertyDescriptor(
            after,
            name,
          );
          const propertyNode = node.appendProperty(name, {
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
          node.diff.properties[name] = propertyNode.diff;

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
    const stringifyOneDescriptor = ({
      propertyNode,
      property,
      descriptorName,
      descriptorValue,
      colors = {},
    }) => {
      let descriptorString = "";

      descriptorString += `  `.repeat(propertyNode.depth);
      if (descriptorName !== "value") descriptorString += `${descriptorName} `;
      descriptorString +=
        colors && colors.key
          ? ANSI.color(stringifyPropertyKey(property), colors.key)
          : stringifyPropertyKey(property);
      descriptorString +=
        colors && colors.delimiters ? ANSI.color(":", colors.delimiters) : ":";
      descriptorString += " ";
      descriptorString +=
        colors && colors.value
          ? ANSI.color(stringify(descriptorValue), colors.value)
          : stringify(descriptorValue);
      descriptorString +=
        colors && colors.delimiters ? ANSI.color(",", colors.delimiters) : ",";
      descriptorString += "\n";
      return descriptorString;
    };

    const visitForDiff = (node) => {
      if (node.diff.identity) {
        let identityDiff = "";
        identityDiff += `${ANSI.color("-", ANSI.RED)}`;
        identityDiff += ` ${stringify(node.before)}`;
        identityDiff += `\n`;
        identityDiff += `${ANSI.color("+", ANSI.GREEN)}`;
        identityDiff += ` ${stringify(node.after)}`;
        return identityDiff;
      }
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
            let descriptorDiff = "";
            const descriptorNode = propertyNode.descriptors[descriptorName];
            if (descriptorNode.diff.count === 0) {
              if (isDefaultDescriptor(descriptorName, descriptorNode.before)) {
                continue;
              }
              descriptorDiff += stringifyOneDescriptor({
                propertyNode,
                property,
                descriptorName,
                descriptorValue: descriptorNode.before,
              });
              descriptorDiff = ANSI.color(descriptorDiff, ANSI.GREY);
              propertyDiff += descriptorDiff;
              continue;
            }
            if (descriptorNode.diff.removed) {
              if (isDefaultDescriptor(descriptorName, descriptorNode.before)) {
                continue;
              }
              descriptorDiff += `-`;
              descriptorDiff += stringifyOneDescriptor({
                propertyNode,
                property,
                descriptorName,
                descriptorValue: descriptorNode.before,
              });
              descriptorDiff = ANSI.color(descriptorDiff, ANSI.RED);
              propertyDiff += descriptorDiff;
              continue;
            }
            if (descriptorNode.diff.added) {
              if (isDefaultDescriptor(descriptorName, descriptorNode.after)) {
                continue;
              }
              descriptorDiff += "+";
              descriptorDiff += stringifyOneDescriptor({
                propertyNode,
                property,
                descriptorName,
                descriptorValue: descriptorNode.after,
              });
              descriptorDiff = ANSI.color(descriptorDiff, ANSI.GREEN);
              propertyDiff += descriptorDiff;
              continue;
            }
            descriptorDiff += ANSI.color("-", ANSI.RED);
            descriptorDiff += stringifyOneDescriptor({
              propertyNode,
              property,
              descriptorName,
              descriptorValue: descriptorNode.before,
              colors: {
                key: ANSI.GREY,
                delimiters: ANSI.GREY,
                value: ANSI.RED,
              },
            }).slice(1);
            descriptorDiff += ANSI.color("+", ANSI.GREEN);
            descriptorDiff += stringifyOneDescriptor({
              propertyNode,
              property,
              descriptorName,
              descriptorValue: descriptorNode.after,
              colors: {
                key: ANSI.GREY,
                delimiters: ANSI.GREY,
                value: ANSI.GREEN,
              },
            }).slice(1);
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
