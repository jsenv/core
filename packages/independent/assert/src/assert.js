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
    const createNode = ({
      type,
      actual,
      expected,
      property,
      parent,
      depth,
    }) => {
      const node = {
        type,
        actual,
        expected,
        property,
        parent,
        depth,
        failed: false,
        children: [],
        failures: [],
        addFailure: (message) => {
          node.failed = true;
          node.failures.push(message);
          if (node.parent) {
            node.parent.failed = true;
          }
        },
        appendChild: ({ type, actual, expected, property }) => {
          const childNode = createNode({
            type,
            actual,
            expected,
            property,
            parent: node,
            depth: depth + 1,
          });
          node.children.push(childNode);
          return childNode;
        },
      };
      return node;
    };
    const rootNode = createNode({
      type: "root",
      actual,
      expected,
      depth: 0,
    });

    const visit = (node) => {
      const { actual, expected } = node;
      if (isPrimitive(expected) || isPrimitive(actual)) {
        if (actual !== expected) {
          node.addFailure();
          return;
        }
        return;
      }

      // for simplicity now let's assume both are objects
      // with same prototypes and we'll compare only the property value)
      const actualPropertyNames = Object.getOwnPropertyNames(actual);
      const expectedPropertyNames = Object.getOwnPropertyNames(expected);
      for (const actualPropertyName of actualPropertyNames) {
        const actualPropertyDescriptor = Object.getOwnPropertyDescriptor(
          actual,
          actualPropertyName,
        );
        if (!expectedPropertyNames.includes(actualPropertyName)) {
          node.addFailure();
          continue;
        }
        const expectedPropertyDescriptor = Object.getOwnPropertyDescriptor(
          expected,
          actualPropertyName,
        );
        const expectedPropertyValue = expectedPropertyDescriptor.value;
        const actualPropertyValue = actualPropertyDescriptor.value;
        const propertyValueNode = node.appendChild({
          type: "property_value",
          actual: actualPropertyValue,
          expected: expectedPropertyValue,
          property: actualPropertyName,
        });
        visit(propertyValueNode);
      }

      for (const expectedPropertyName of expectedPropertyNames) {
        if (!actualPropertyNames.includes(expectedPropertyName)) {
          // const expectedPropertyDescriptor = Object.getOwnPropertyDescriptor(
          //   expected,
          //   expectedPropertyName,
          // );
          node.addFailure();
          continue;
        }
      }
    };
    visit(rootNode);

    if (!rootNode.failed) {
      return;
    }

    const generateDiff = () => {
      let diff = "";

      const prefixActualDiff = (node) => {
        let diff = "";
        const color = node.failed ? ANSI.RED : ANSI.GREY;

        if (node.depth === 0) {
          diff += `actual  : `;
          diff += ANSI.color(node.actual, color);
          diff += "\n";
          return diff;
        }
        if (node.failed) {
          diff += ANSI.color("-", color);
        }
        const indent = "  ".repeat(node.depth);
        diff += ` ${indent}`;
        if (node.property) {
          diff += ANSI.color(`${node.property}: `, color);
          diff += ANSI.color(stringifyValue(node.actual), color);
          diff += ANSI.color(",", color);
        } else {
          diff += ANSI.color(stringifyValue(node.actual), color);
        }
        diff += "\n";
        return diff;
      };
      const prefixExpectedDiff = (node) => {
        let diff = "";
        const color = node.failed ? ANSI.GREEN : ANSI.GREY;

        if (node.depth === 0) {
          diff += `expected: `;
          diff += ANSI.color(node.expected, color);
          diff += "\n";
          return diff;
        }
        if (node.failed) {
          diff += ANSI.color("+", color);
        }
        const indent = "  ".repeat(node.depth);
        diff += ` ${indent}`;
        if (node.property) {
          diff += ANSI.color(`${node.property}: `, color);
          diff += ANSI.color(stringifyValue(node.expected), color);
          diff += ANSI.color(",", color);
        } else {
          diff += ANSI.color(stringifyValue(node.expected), color);
        }
        return diff;
      };

      const visitForDiff = (node, indent = "") => {
        if (isPrimitive(node.expected)) {
          if (node.failed) {
            diff += prefixActualDiff(node);
            diff += prefixExpectedDiff(node);
          } else {
            diff += prefixActualDiff(node);
          }
        } else if (isPrimitive(node.actual)) {
          diff += prefixActualDiff(node);
          diff += prefixExpectedDiff(node);
        } else {
          diff += "{";
          if (node.children.length) {
            diff += "\n";
            for (const child of node.children) {
              visitForDiff(child, `${indent}  `);
            }
            diff += "\n";
          }
          diff += "}";
        }
      };
      visitForDiff(rootNode);
      return diff;
    };

    let message = `assert({ ${ANSI.color("actual", ANSI.RED)}, ${ANSI.color("expected", ANSI.GREEN)} })`;
    const diff = generateDiff();
    message += `\n\n${diff}`;
    const error = new Error(message);
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

const stringifyProperty = (propertyDescriptor, propertyName) => {
  // TODO: if there is getter, setter, etc we must stringify
  // all gettter, setter, configurability, enumerability etc
  // like this:
  // + get name() {},
  // + set name() {},
  // + configurable name: false,
  // + enumerable name: false,
  let propertyString = "";
  propertyString += `+ ${stringifyPropertyName(propertyName)}:`;
  propertyString += `${stringifyValue(propertyDescriptor.value)}`;
  return propertyString;
};

const stringifyPropertyName = (name) => {
  // todo: handle property that must be between quotes,
  // handle symbols
  return name;
};

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

const stringifyValue = (value) => {
  return isPrimitive(value)
    ? stringifyPrimitive(value)
    : stringifyComposite(value);
};
