import { isPrimitive } from "./is_composite.js";
import { findPreviousComparison } from "./find_previous_comparison.js";
import {
  isSet,
  isMap,
  isRegExp,
  isError,
  isArray,
  somePrototypeMatch,
} from "./object_subtype.js";

export const compare = ({ actual, expected }, { checkPropertiesOrder }) => {
  const comparison = createComparison({
    type: "root",
    actual,
    expected,
  });
  comparison.failed = !defaultComparer(comparison, { checkPropertiesOrder });
  return comparison;
};

const expectationSymbol = Symbol.for("expectation");

const createExpectation = (data) => {
  return {
    [expectationSymbol]: true,
    data,
  };
};

export const createNotExpectation = (value) => {
  return createExpectation({
    type: "not",
    expected: value,
    comparer: ({ actual }) => {
      if (isNegativeZero(value)) {
        return !isNegativeZero(actual);
      }
      if (isNegativeZero(actual)) {
        return !isNegativeZero(value);
      }
      return actual !== value;
    },
  });
};

export const createAnyExpectation = (expectedConstructor) => {
  return createExpectation({
    type: "any",
    expected: expectedConstructor,
    comparer: ({ actual }) => {
      return somePrototypeMatch(
        actual,
        ({ constructor }) =>
          constructor &&
          (constructor === expectedConstructor ||
            constructor.name === expectedConstructor.name),
      );
    },
  });
};

export const createMatchesRegExpExpectation = (regexp) => {
  return createExpectation({
    type: "matchesRegExp",
    expected: regexp,
    comparer: ({ actual }) => {
      if (typeof actual !== "string") {
        return false;
      }
      return regexp.test(actual);
    },
  });
};

const createComparison = ({ parent = null, children = [], ...rest }) => {
  const comparison = {
    parent,
    children,
    ...rest,
  };
  return comparison;
};

const defaultComparer = (comparison, options) => {
  const { actual, expected } = comparison;

  if (
    typeof expected === "object" &&
    expected !== null &&
    expectationSymbol in expected
  ) {
    subcompare(comparison, {
      ...expected.data,
      actual,
      options,
    });
    return !comparison.failed;
  }

  if (isPrimitive(expected) || isPrimitive(actual)) {
    compareIdentity(comparison, options);
    return !comparison.failed;
  }

  const expectedReference = findPreviousComparison(
    comparison,
    (referenceComparisonCandidate) =>
      referenceComparisonCandidate !== comparison &&
      referenceComparisonCandidate.expected === comparison.expected,
  );
  if (expectedReference) {
    if (expectedReference.actual === comparison.actual) {
      subcompare(comparison, {
        type: "reference",
        actual: expectedReference,
        expected: expectedReference,
        comparer: () => true,
        options,
      });
      return true;
    }
    subcompare(comparison, {
      type: "reference",
      actual: findPreviousComparison(
        comparison,
        (referenceComparisonCandidate) =>
          referenceComparisonCandidate !== comparison &&
          referenceComparisonCandidate.actual === comparison.actual,
      ),
      expected: expectedReference,
      comparer: ({ actual, expected }) => actual === expected,
      options,
    });
    if (comparison.failed) return false;
    // if we expectedAReference and it did not fail, we are done
    // this expectation was already compared and comparing it again
    // would cause infinite loop
    return true;
  }

  const actualReference = findPreviousComparison(
    comparison,
    (referenceComparisonCandidate) =>
      referenceComparisonCandidate !== comparison &&
      referenceComparisonCandidate.actual === comparison.actual,
  );
  if (actualReference) {
    subcompare(comparison, {
      type: "reference",
      actual: actualReference,
      expected: null,
      comparer: () => false,
      options,
    });
    return false;
  }

  compareIdentity(comparison, options);
  // actual === expected, no need to compare prototype, properties, ...
  if (!comparison.failed) {
    return true;
  }
  comparison.failed = false;

  comparePrototype(comparison, options);
  if (comparison.failed) {
    return false;
  }

  compareIntegrity(comparison, options);
  if (comparison.failed) {
    return false;
  }

  compareExtensibility(comparison, options);
  if (comparison.failed) {
    return false;
  }

  comparePropertiesDescriptors(comparison, options);
  if (comparison.failed) {
    return false;
  }

  compareProperties(comparison, options);
  if (comparison.failed) {
    return false;
  }

  compareSymbolsDescriptors(comparison, options);
  if (comparison.failed) {
    return false;
  }

  compareSymbols(comparison, options);
  if (comparison.failed) {
    return false;
  }

  if (typeof Set === "function" && isSet(expected)) {
    compareSetEntries(comparison, options);
    if (comparison.failed) {
      return false;
    }
  }

  if (typeof Map === "function" && isMap(expected)) {
    compareMapEntries(comparison, options);
    if (comparison.failed) {
      return false;
    }
  }

  if ("valueOf" in expected && typeof expected.valueOf === "function") {
    // always keep this one after properties because we must first ensure
    // valueOf is on both actual and expected
    // usefull because new Date(10).valueOf() === 10
    // or new Boolean(true).valueOf() === true
    compareValueOfReturnValue(comparison, options);
    if (comparison.failed) {
      return false;
    }
  }

  // required otherwise assert({ actual: /a/, expected: /b/ }) would not throw
  if (isRegExp(expected)) {
    compareToStringReturnValue(comparison, options);
    if (comparison.failed) {
      return false;
    }
  }

  return true;
};

const subcompare = (
  comparison,
  { type, data, actual, expected, comparer = defaultComparer, options },
) => {
  const subcomparison = createComparison({
    type,
    data,
    actual,
    expected,
    parent: comparison,
  });
  comparison.children.push(subcomparison);
  subcomparison.failed = !comparer(subcomparison, options);
  comparison.failed = subcomparison.failed;
  return subcomparison;
};

const compareIdentity = (comparison, options) => {
  const { actual, expected } = comparison;
  subcompare(comparison, {
    type: "identity",
    actual,
    expected,
    comparer: () => {
      if (isBuffer(actual) && isBuffer(expected)) {
        return actual.equals(expected);
      }
      if (isNegativeZero(expected)) {
        return isNegativeZero(actual);
      }
      if (isNegativeZero(actual)) {
        return isNegativeZero(expected);
      }
      return actual === expected;
    },
    options,
  });
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

const comparePrototype = (comparison, options) => {
  subcompare(comparison, {
    type: "prototype",
    actual: Object.getPrototypeOf(comparison.actual),
    expected: Object.getPrototypeOf(comparison.expected),
    options,
  });
};

const compareExtensibility = (comparison, options) => {
  subcompare(comparison, {
    type: "extensibility",
    actual: Object.isExtensible(comparison.actual)
      ? "extensible"
      : "non-extensible",
    expected: Object.isExtensible(comparison.expected)
      ? "extensible"
      : "non-extensible",
    comparer: ({ actual, expected }) => actual === expected,
    options,
  });
};

// https://tc39.github.io/ecma262/#sec-setintegritylevel
const compareIntegrity = (comparison, options) => {
  subcompare(comparison, {
    type: "integrity",
    actual: getIntegriy(comparison.actual),
    expected: getIntegriy(comparison.expected),
    comparer: ({ actual, expected }) => actual === expected,
    options,
  });
};

const getIntegriy = (value) => {
  if (Object.isFrozen(value)) return "frozen";
  if (Object.isSealed(value)) return "sealed";
  return "none";
};

const compareProperties = (comparison, options) => {
  const { actual, expected } = comparison;

  const isErrorConstructor =
    typeof actual === "function" && actual.name === "Error";
  const ignoredProperties = isErrorConstructor ? ["prepareStackTrace"] : [];
  const expectedPropertyNames = Object.getOwnPropertyNames(expected);
  const actualPropertyNames = Object.getOwnPropertyNames(actual);
  const actualMissing = expectedPropertyNames.filter((name) => {
    const missing = actualPropertyNames.indexOf(name) === -1;
    return missing && ignoredProperties.indexOf(name) === -1;
  });
  const actualExtra = actualPropertyNames.filter((name) => {
    const extra = expectedPropertyNames.indexOf(name) === -1;
    return extra && ignoredProperties.indexOf(name) === -1;
  });
  const expectedMissing = [];
  const expectedExtra = [];
  subcompare(comparison, {
    type: "properties",
    actual: { missing: actualMissing, extra: actualExtra },
    expected: { missing: expectedMissing, extra: expectedExtra },
    comparer: () => actualMissing.length === 0 && actualExtra.length === 0,
    options,
  });
  if (comparison.failed) {
    return;
  }

  if (options.checkPropertiesOrder && !isErrorConstructor) {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    subcompare(comparison, {
      type: "properties-order",
      actual: actualKeys,
      expected: expectedKeys,
      comparer: () =>
        expectedKeys.every((name, index) => name === actualKeys[index]),
      options,
    });
  }
};

const compareSymbols = (comparison, options) => {
  const { actual, expected } = comparison;

  const expectedSymbols = Object.getOwnPropertySymbols(expected);
  const actualSymbols = Object.getOwnPropertySymbols(actual);
  const actualMissing = expectedSymbols.filter(
    (symbol) => actualSymbols.indexOf(symbol) === -1,
  );
  const actualExtra = actualSymbols.filter(
    (symbol) => expectedSymbols.indexOf(symbol) === -1,
  );
  const expectedMissing = [];
  const expectedExtra = [];

  subcompare(comparison, {
    type: "symbols",
    actual: { missing: actualMissing, extra: actualExtra },
    expected: { missing: expectedMissing, extra: expectedExtra },
    comparer: () => actualMissing.length === 0 && actualExtra.length === 0,
    options,
  });
  if (comparison.failed) return;

  if (options.checkPropertiesOrder) {
    subcompare(comparison, {
      type: "symbols-order",
      actual: actualSymbols,
      expected: expectedSymbols,
      comparer: () =>
        expectedSymbols.every(
          (symbol, index) => symbol === actualSymbols[index],
        ),
      options,
    });
  }
};

const comparePropertiesDescriptors = (comparison, options) => {
  const { expected } = comparison;
  const expectedPropertyNames = Object.getOwnPropertyNames(expected);
  // eslint-disable-next-line no-unused-vars
  for (const expectedPropertyName of expectedPropertyNames) {
    comparePropertyDescriptor(
      comparison,
      expectedPropertyName,
      expected,
      options,
    );
    if (comparison.failed) break;
  }
};

const compareSymbolsDescriptors = (comparison, options) => {
  const { expected } = comparison;
  const expectedSymbols = Object.getOwnPropertySymbols(expected);
  // eslint-disable-next-line no-unused-vars
  for (const expectedSymbol of expectedSymbols) {
    comparePropertyDescriptor(comparison, expectedSymbol, expected, options);
    if (comparison.failed) break;
  }
};

const comparePropertyDescriptor = (comparison, property, owner, options) => {
  const { actual, expected } = comparison;

  const expectedDescriptor = Object.getOwnPropertyDescriptor(
    expected,
    property,
  );
  const actualDescriptor = Object.getOwnPropertyDescriptor(actual, property);
  if (!actualDescriptor) {
    return;
  }

  const configurableComparison = subcompare(comparison, {
    type: "property-configurable",
    data: property,
    actual: actualDescriptor.configurable ? "configurable" : "non-configurable",
    expected: expectedDescriptor.configurable
      ? "configurable"
      : "non-configurable",
    comparer: ({ actual, expected }) => actual === expected,
    options,
  });
  if (configurableComparison.failed) {
    return;
  }

  const enumerableComparison = subcompare(comparison, {
    type: "property-enumerable",
    data: property,
    actual: actualDescriptor.enumerable ? "enumerable" : "non-enumerable",
    expected: expectedDescriptor.enumerable ? "enumerable" : "non-enumerable",
    comparer: ({ actual, expected }) => actual === expected,
    options,
  });
  if (enumerableComparison.failed) {
    return;
  }

  const writableComparison = subcompare(comparison, {
    type: "property-writable",
    data: property,
    actual: actualDescriptor.writable ? "writable" : "non-writable",
    expected: expectedDescriptor.writable ? "writable" : "non-writable",
    comparer: ({ actual, expected }) => actual === expected,
    options,
  });
  if (writableComparison.failed) {
    return;
  }

  if (isError(owner) && isErrorPropertyIgnored(property)) {
    return;
  }

  if (typeof owner === "function") {
    if (owner.name === "RegExp" && isRegExpPropertyIgnored(property)) {
      return;
    }
    if (isFunctionPropertyIgnored(property)) {
      return;
    }
  }

  const getComparison = subcompare(comparison, {
    type: "property-get",
    data: property,
    actual: actualDescriptor.get,
    expected: expectedDescriptor.get,
    options,
  });
  if (getComparison.failed) {
    return;
  }

  const setComparison = subcompare(comparison, {
    type: "property-set",
    data: property,
    actual: actualDescriptor.set,
    expected: expectedDescriptor.set,
    options,
  });
  if (setComparison.failed) {
    return;
  }

  const valueComparison = subcompare(comparison, {
    type: "property-value",
    data: isArray(expected) ? propertyToArrayIndex(property) : property,
    actual: actualDescriptor.value,
    expected: expectedDescriptor.value,
    options,
  });
  if (valueComparison.failed) {
    return;
  }
};

const isRegExpPropertyIgnored = (name) =>
  RegExpIgnoredProperties.includes(name);

const isFunctionPropertyIgnored = (name) =>
  functionIgnoredProperties.includes(name);

const isErrorPropertyIgnored = (name) => errorIgnoredProperties.includes(name);

// some regexp properties fails the comparison but that's expected
// to my experience it happens only in webkit.
// check https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/RegExp/input
// to see why these properties exists and would fail between each regex instance
const RegExpIgnoredProperties = [
  "input",
  "$_",
  "lastMatch",
  "$&",
  "lastParen",
  "$+",
  "leftContext",
  "$`",
  "rightContext",
  "$'",
];

const functionIgnoredProperties = [
  // function caller would fail comparison but that's expected
  "caller",
  // function arguments would fail comparison but that's expected
  "arguments",
];

const errorIgnoredProperties = [
  // stack fails comparison but it's not important
  "stack",
  // firefox properties that would fail comparison but that's expected
  "file",
  "fileName",
  "lineNumber",
  "columnNumber",
  // webkit properties that would fail comparison but that's expected
  "line",
  "column",
  "sourceURL",
];

const propertyToArrayIndex = (property) => {
  if (typeof property !== "string") return property;
  const propertyAsNumber = parseInt(property, 10);
  if (Number.isInteger(propertyAsNumber) && propertyAsNumber >= 0) {
    return propertyAsNumber;
  }
  return property;
};

const compareSetEntries = (comparison, options) => {
  const { actual, expected } = comparison;

  const expectedEntries = Array.from(expected.values()).map((value, index) => {
    return { index, value };
  });
  const actualEntries = Array.from(actual.values()).map((value, index) => {
    return { index, value };
  });

  // first check actual entries match expected entries
  // eslint-disable-next-line no-unused-vars
  for (const actualEntry of actualEntries) {
    const expectedEntry = expectedEntries[actualEntry.index];
    if (expectedEntry) {
      const entryComparison = subcompare(comparison, {
        type: "set-entry",
        data: actualEntry.index,
        actual: actualEntry.value,
        expected: expectedEntry.value,
        options,
      });
      if (entryComparison.failed) return;
    }
  }

  const actualSize = actual.size;
  const expectedSize = expected.size;
  const sizeComparison = subcompare(comparison, {
    type: "set-size",
    actual: actualSize,
    expected: expectedSize,
    comparer: () => actualSize === expectedSize,
    options,
  });
  if (sizeComparison.failed) return;
};

const compareMapEntries = (comparison, options) => {
  const { actual, expected } = comparison;

  const actualEntries = Array.from(actual.keys()).map((key) => {
    return { key, value: actual.get(key) };
  });
  const expectedEntries = Array.from(expected.keys()).map((key) => {
    return { key, value: expected.get(key) };
  });

  const entryMapping = [];
  const expectedEntryCandidates = expectedEntries.slice();

  actualEntries.forEach((actualEntry) => {
    const expectedEntry = expectedEntryCandidates.find(
      (expectedEntryCandidate) => {
        const mappingComparison = subcompare(comparison, {
          type: "map-entry-key-mapping",
          actual: actualEntry.key,
          expected: expectedEntryCandidate.key,
          options,
        });
        if (mappingComparison.failed) {
          comparison.failed = false;
          return false;
        }
        return true;
      },
    );
    if (expectedEntry)
      expectedEntryCandidates.splice(
        expectedEntryCandidates.indexOf(expectedEntry),
        1,
      );
    entryMapping.push({ actualEntry, expectedEntry });
  });

  // should we ensure entries are defined in the same order ?
  // I'm not sure about that, but maybe.
  // in that case, just like for properties order
  // this is the last thing we would check
  // because it gives less information

  // first check all actual entry macthes expected entry
  let index = 0;
  // eslint-disable-next-line no-unused-vars
  for (const actualEntry of actualEntries) {
    const actualEntryMapping = entryMapping.find(
      (mapping) => mapping.actualEntry === actualEntry,
    );
    if (actualEntryMapping && actualEntryMapping.expectedEntry) {
      const mapEntryComparison = subcompare(comparison, {
        type: "map-entry",
        data: index,
        actual: actualEntry,
        expected: actualEntryMapping.expectedEntry,
        options,
      });
      if (mapEntryComparison.failed) return;
    }
    index++;
  }

  // second check there is no unexpected entry
  const mappingWithoutExpectedEntry = entryMapping.find(
    (mapping) => mapping.expectedEntry === undefined,
  );
  const unexpectedEntry = mappingWithoutExpectedEntry
    ? mappingWithoutExpectedEntry.actualEntry
    : null;
  const unexpectedEntryComparison = subcompare(comparison, {
    type: "map-entry",
    actual: unexpectedEntry,
    expected: null,
    options,
  });
  if (unexpectedEntryComparison.failed) return;

  // third check there is no missing entry (expected but not found)
  const expectedEntryWithoutActualEntry = expectedEntries.find(
    (expectedEntry) =>
      entryMapping.every((mapping) => mapping.expectedEntry !== expectedEntry),
  );
  const missingEntry = expectedEntryWithoutActualEntry || null;
  const missingEntryComparison = subcompare(comparison, {
    type: "map-entry",
    actual: null,
    expected: missingEntry,
    options,
  });
  if (missingEntryComparison.failed) return;
};

const compareValueOfReturnValue = (comparison, options) => {
  subcompare(comparison, {
    type: "value-of-return-value",
    actual: comparison.actual.valueOf(),
    expected: comparison.expected.valueOf(),
    options,
  });
};

const compareToStringReturnValue = (comparison, options) => {
  subcompare(comparison, {
    type: "to-string-return-value",
    actual: comparison.actual.toString(),
    expected: comparison.expected.toString(),
    options,
  });
};
