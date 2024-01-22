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
        // for simplicity now let's assume both are objects
        // with same prototypes and we'll compare only the property value)
        const beforePropertyNames = Object.getOwnPropertyNames(before);
        for (const beforePropertyName of beforePropertyNames) {
          const beforePropertyDescriptor = Object.getOwnPropertyDescriptor(
            before,
            beforePropertyName,
          );
          const afterPropertyDescriptor = Object.getOwnPropertyDescriptor(
            after,
            beforePropertyName,
          );
          const propertyNode = node.appendProperty(beforePropertyName, {
            before: beforePropertyDescriptor,
            after: afterPropertyDescriptor,
          });

          if (!afterPropertyDescriptor) {
            propertyNode.diff = {
              count: 1,
              removed: true,
            };
            node.diff.properties[beforePropertyName] = propertyNode.diff;
            node.diff.count += propertyNode.diff.count;
            continue;
          }

          propertyNode.diff = {
            count: 0,
            value: null,
            enumerable: null,
            writable: null,
            configurable: null,
            set: null,
            get: null,
          };
          property_value: {
            const valueNode = propertyNode.appendProperty("value", {
              before: beforePropertyDescriptor.value,
              after: afterPropertyDescriptor.value,
            });
            visit(valueNode);
            propertyNode.diff.value = valueNode.diff;
            propertyNode.diff.count += valueNode.diff.count;
          }
          property_enumerable: {
            const enumerableNode = propertyNode.appendProperty("enumerable", {
              before: beforePropertyDescriptor.enumerable,
              after: afterPropertyDescriptor.enumerable,
            });
            visit(enumerableNode);
            propertyNode.diff.enumerable = enumerableNode.diff;
            propertyNode.diff.count += enumerableNode.diff.count;
          }
          property_writable: {
            const writableNode = propertyNode.appendProperty("writable", {
              before: beforePropertyDescriptor.writable,
              after: afterPropertyDescriptor.writable,
            });
            visit(writableNode);
            propertyNode.diff.writable = writableNode.diff;
            propertyNode.diff.count += writableNode.diff.count;
          }
          property_configurable: {
            const configurableNode = propertyNode.appendProperty(
              "configurable",
              {
                before: beforePropertyDescriptor.configurable,
                after: afterPropertyDescriptor.configurable,
              },
            );
            visit(configurableNode);
            propertyNode.diff.configurable = configurableNode.diff;
            propertyNode.diff.count += configurableNode.diff.count;
          }
          property_set: {
            const setNode = propertyNode.appendProperty("set", {
              before: beforePropertyDescriptor.set,
              after: afterPropertyDescriptor.set,
            });
            visit(setNode);
            propertyNode.diff.set = setNode.diff;
            propertyNode.diff.count += setNode.diff.count;
          }
          property_get: {
            const getNode = propertyNode.appendProperty("get", {
              before: beforePropertyDescriptor.get,
              after: afterPropertyDescriptor.get,
            });
            visit(getNode);
            propertyNode.diff.get = getNode.diff;
            propertyNode.diff.count += getNode.diff.count;
          }
          node.diff.properties[beforePropertyName] = propertyNode.diff;
          node.diff.count += propertyNode.diff.count;
        }
        const afterPropertyNames = Object.getOwnPropertyNames(actual);
        for (const afterPropertyName of afterPropertyNames) {
          if (!beforePropertyNames.includes(afterPropertyName)) {
            const afterPropertyDescriptor = Object.getOwnPropertyDescriptor(
              after,
              afterPropertyName,
            );
            const propertyNode = node.appendProperty(afterPropertyName, {
              before: null,
              after: afterPropertyDescriptor,
            });
            propertyNode.diff = {
              count: 1,
              added: true,
            };
            node.diff.properties[afterPropertyName] = propertyNode.diff;
            node.diff.count += propertyNode.diff.count;
            continue;
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
    const isDefaultPropertyDescriptor = (key, value) => {
      if (key === "enumerable" && value === true) {
        return true;
      }
      if (key === "writable" && value === true) {
        return true;
      }
      if (key === "configurable" && value === true) {
        return true;
      }
      return false;
    };
    const stringifyOneDescriptor = ({
      key,
      value,
      propertyNode,
      property,
      colors = {},
    }) => {
      let descriptorString = "";

      descriptorString += `  `.repeat(propertyNode.depth);
      if (key === "get") {
        descriptorString += `get ${stringifyPropertyKey(property)}()`;
        // TODO: put getter stringification result here
        descriptorString += ",\n";
      }
      if (key === "set") {
        descriptorString += `set ${stringifyPropertyKey(property)}()`;
        // TODO: put setter stringification result here
        descriptorString += ",\n";
      }
      if (key === "enumerable") {
        descriptorString += `enumerable ${stringifyPropertyKey(property)}`;
        descriptorString += ": ";
        descriptorString +=
          colors && colors.value ? ANSI.color(value, colors.value) : value;
        descriptorString += ",\n";
      }
      if (key === "writable") {
        descriptorString += `writable ${stringifyPropertyKey(property)}`;
        descriptorString += ": ";
        descriptorString +=
          colors && colors.value ? ANSI.color(value, colors.value) : value;
        descriptorString += ",\n";
      }
      if (key === "configurable") {
        descriptorString += `configurable ${stringifyPropertyKey(property)}`;
        descriptorString += ": ";
        descriptorString +=
          colors && colors.value ? ANSI.color(value, colors.value) : value;
        descriptorString += ",\n";
      }
      if (key === "value") {
        descriptorString += `${stringifyPropertyKey(property)}`;
        descriptorString += ": ";
        descriptorString +=
          colors && colors.value
            ? ANSI.color(stringify(value), colors.value)
            : stringify(value);
        descriptorString += ",\n";
      }
      return descriptorString;
    };
    const stringifyDescriptor = (descriptor, { propertyNode, property }) => {
      let propertyString = "";
      for (const key of Object.keys(descriptor)) {
        const value = descriptor[key];
        if (isDefaultPropertyDescriptor(key, value)) {
          continue;
        }
        propertyString += stringifyOneDescriptor({
          key,
          value,
          propertyNode,
          property,
        });
      }
      return propertyString;
    };
    const stringifyProperty = (propertyNode, property) => {
      if (propertyNode.diff.count) {
        let propertyDiffString = "";
        if (propertyNode.diff.removed) {
          propertyDiffString += "-";
          propertyDiffString += stringifyDescriptor(propertyNode.before, {
            propertyNode,
            property,
          });
          propertyDiffString = ANSI.color(propertyDiffString, ANSI.RED);
          return propertyDiffString;
        }
        if (propertyNode.diff.added) {
          propertyDiffString += "+";
          propertyDiffString += stringifyDescriptor(propertyNode.after, {
            propertyNode,
            property,
          });
          propertyDiffString = ANSI.color(propertyDiffString, ANSI.GREEN);
          return propertyDiffString;
        }
        // there is 1/many diff on property descriptor
        for (const key of Object.keys(propertyNode.before)) {
          const value = propertyNode.before[key];
          const descriptorDiff = propertyNode.diff[key];
          if (descriptorDiff.count === 0) {
            if (isDefaultPropertyDescriptor(key, value)) {
              continue;
            }
            propertyDiffString += ANSI.color(
              stringifyOneDescriptor({
                key,
                value,
                propertyNode,
                property,
              }),
              ANSI.GREY,
            );
            continue;
          }
          propertyDiffString += ANSI.color("-", ANSI.RED);
          propertyDiffString += stringifyOneDescriptor({
            key,
            value,
            propertyNode,
            property,
            colors: { value: ANSI.RED },
          });
          propertyDiffString += ANSI.color("+", ANSI.GREEN);
          propertyDiffString += stringifyOneDescriptor({
            key,
            value: propertyNode.after[key],
            propertyNode,
            property,
            colors: { value: ANSI.GREEN },
          });
        }
        return propertyDiffString;
      }
      let propertyString = stringifyDescriptor(propertyNode.before, {
        propertyNode,
        property,
      });
      propertyString = ANSI.color(propertyString, ANSI.GREY);
      return propertyString;
    };

    let message;
    if (rootNode.diff.identity) {
      message = `${ANSI.color("actual", ANSI.RED)} and ${ANSI.color("expected", ANSI.GREEN)} are different`;
      message += `\n\n`;
      message += stringify(rootNode.before);
      message += `\n`;
      message += stringify(rootNode.after);
    } else {
      message = `${ANSI.color("actual", ANSI.RED)} contains ${rootNode.diff.count} ${rootNode.diff.count === 1 ? "difference" : "differences"} with ${ANSI.color("expected", ANSI.GREEN)}`;
      message += `\n\n`;
      const visit = (node) => {
        if (node.diff.identity) {
          let diff = "";
          diff += `${ANSI.color("-", ANSI.RED)}`;
          diff += ` ${stringify(node.before)}`;
          diff += `\n`;
          diff += `${ANSI.color("+", ANSI.GREEN)}`;
          diff += ` ${stringify(node.after)}`;
          return diff;
        }
        // composite but different
        let diff = ANSI.color("{", ANSI.GREY);
        const propertyNames = Object.keys(node.properties);
        if (propertyNames.length) {
          diff += "\n";
          for (const property of propertyNames) {
            const propertyNode = node.properties[property];
            const propertyDiff = stringifyProperty(propertyNode, property);
            diff += propertyDiff;
          }
        }
        diff += ANSI.color("}", ANSI.GREY);
        return diff;
      };
      const diff = visit(rootNode);
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
