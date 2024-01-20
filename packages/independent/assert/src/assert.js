import { isPrimitive } from "./utils/is_composite.js";
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
    const { actual, expected } = firstArg;

    let comparisonDiff = "";
    const createNode = ({ type, actual, expected, parent, depth }) => {
      const node = {
        type,
        actual,
        expected,
        parent,
        depth,
        failed: false,
        children: [],
        failures: [],
        addFailure: (message) => {
          node.failures.push(message);
          if (node.parent) {
            node.parent.failed = true;
          }
        },
        appendChild: ({ type, actual, expected }) => {
          const childNode = createNode({
            type,
            actual,
            expected,
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
        if (isBuffer(actual) && isBuffer(expected)) {
          if (!actual.equals(expected)) {
            // in theory we should compare the buffers
            // (it can be very slow + it does not help much to see binary diff so we'll skip)
            comparisonDiff += `+ Buffer(${actual.length})`;
            comparisonDiff += `- Buffer(${expected.length})`;
            node.addFailure();
          }
          return;
        }
        if (isNegativeZero(expected)) {
          if (!isNegativeZero(actual)) {
            comparisonDiff += `+ ${stringify(actual)}`;
            comparisonDiff += `- -0`;
            node.addFailure();
          }
          return;
        }
        if (isNegativeZero(actual)) {
          if (!isNegativeZero(expected)) {
            comparisonDiff += `+ -0`;
            comparisonDiff += `- ${stringify(expected)}`;
            node.addFailure();
          }
          return;
        }
        if (actual !== expected) {
          comparisonDiff += `+ ${stringify(actual)}`;
          comparisonDiff += `- ${stringify(expected)}`;
          node.addFailure();
        }
        comparisonDiff += `${stringify(actual)}`;
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
          comparisonDiff += `+ ${stringifyProperty(actualPropertyDescriptor, actualPropertyName)}`;
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
        });
        visit(propertyValueNode);
      }

      for (const expectedPropertyName of expectedPropertyNames) {
        if (!actualPropertyNames.includes(expectedPropertyName)) {
          const expectedPropertyDescriptor = Object.getOwnPropertyDescriptor(
            expected,
            expectedPropertyName,
          );
          comparisonDiff += `+ ${stringifyProperty(expectedPropertyDescriptor, expectedPropertyName)}`;
          node.addFailure();
          continue;
        }
      }
    };
    visit(rootNode);

    if (!rootNode.failed) {
      return;
    }
    const error = new Error(comparisonDiff);
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
  propertyString += `${stringify(propertyDescriptor.value)}`;
  return propertyString;
};

const stringifyPropertyName = (name) => {
  // todo: handle property that must be between quotes,
  // handle symbols
  return name;
};

const stringify = (value) => {
  // TODO: use the same stringification method as the one
  // used while traversing expected
  return JSON.stringify(value);
};

// under some rare and odd circumstances firefox Object.is(-0, -0)
// returns false making test fail.
// it is 100% reproductible with big.test.js.
// However putting debugger or executing Object.is just before the
// comparison prevent Object.is failure.
// It makes me thing there is something strange inside firefox internals.
// All this to say avoid relying on Object.is to test if the value is -0
const isNegativeZero = (value) => {
  return typeof value === "number" && 1 / value === -Infinity;
};
const isBuffer = (value) => {
  return typeof Buffer === "function" && Buffer.isBuffer(value);
};
