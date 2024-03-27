import stringWidth from "string-width";
import Graphemer from "graphemer";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isAssertionError, createAssertionError } from "./assertion_error.js";

const removedSign = UNICODE.FAILURE_RAW;
const addedSign = UNICODE.FAILURE_RAW;
const unexpectedSign = UNICODE.FAILURE_RAW;
const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectedColor = ANSI.RED;
const expectedColor = ANSI.GREEN;
const unexpectedSignColor = ANSI.GREY;
const removedSignColor = ANSI.GREY;
const addedSignColor = ANSI.GREY;
const ARRAY_EMPTY_VALUE = { array_empty_value: true }; // Symbol.for('array_empty_value') ?
// const VALUE_OF_NOT_FOUND = { value_of_not_found: true };
// const DOES_NOT_EXISTS = { does_not_exists: true };

export const createAssert = ({ format = (v) => v } = {}) => {
  const assert = (...args) => {
    // param validation
    let firstArg;
    let actualIsFirst;
    {
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
      firstArg = args[0];
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
    }

    const {
      colors = true,
      actual,
      expected,
      maxDepth = 5,
      maxColumns = 100,
      maxDiffPerObject = 5,
      maxValueAroundDiff = 2,
      maxValueInsideDiff = 4,
      maxDepthInsideDiff = 1,
      maxLineAroundDiff = 2,
      quote = "auto",
      preserveLineBreaks,
      signs,
    } = firstArg;
    if (!colors) {
      ANSI.supported = false;
    }
    const maxValueBeforeDiff = maxValueAroundDiff;
    const maxValueAfterDiff = maxValueAroundDiff;
    const maxLineBeforeDiff = maxLineAroundDiff;
    const maxLineAfterDiff = maxLineAroundDiff;

    actualIsFirst = true;

    // actualIsFirst =
    //   Object.keys(firstArg).indexOf("actual") <
    //   Object.keys(firstArg).indexOf("expected");
    const actualReferenceMap = new Map();
    const getActualReference = (value, node) => {
      const reference = actualReferenceMap.get(value);
      if (reference) {
        reference.referenceFromOthersSet.add(node);
      } else {
        actualReferenceMap.set(value, node);
      }
      return reference;
    };
    const actualNode = createValueNode({
      name: "actual",
      value: actual,
      getReference: getActualReference,
    });
    const expectedReferenceMap = new Map();
    const getExpectedReference = (value, node) => {
      const reference = expectedReferenceMap.get(value);
      if (reference) {
        reference.referenceFromOthersSet.add(node);
      } else {
        expectedReferenceMap.set(value, node);
      }
      return reference;
    };
    const expectedNode = createValueNode({
      name: "expected",
      value: expected,
      getReference: getExpectedReference,
    });
    const causeCounters = {
      total: 0,
      displayed: 0,
    };
    const causeSet = new Set();
    const addCause = (comparison) => {
      if (comparison.type === "line") {
        return;
      }
      if (comparison.type === "char") {
        return;
      }
      if (comparison.type === "property_descriptor") {
        const ownerComparison = comparison.parent.parent;
        if (!comparison.actualNode && !ownerComparison.actualNode) {
          return;
        }
        if (!comparison.expectedNode && !ownerComparison.expectedNode) {
          return;
        }
      }
      if (comparison.hidden) {
        return;
      }
      causeCounters.total++;
      causeSet.add(comparison);
    };
    const removeCause = (comparison) => {
      if (causeSet.has(comparison)) {
        causeCounters.total--;
        causeSet.delete(comparison);
      }
    };
    const onComparisonDisplayed = (comparison) => {
      if (causeSet.has(comparison)) {
        causeSet.delete(comparison);
        causeCounters.displayed++;
      }
      if (comparison.type === "property") {
        // happens when node is skipped
        // in that case we want to consider all child nodes as displayed
        // (they are "displayed" in the summary)
        const propertyDescriptorComparisons =
          comparison.childComparisons.propertyDescriptors;
        for (const propertyDescriptorName of Object.keys(
          propertyDescriptorComparisons,
        )) {
          const propertyDescriptorComparison =
            propertyDescriptorComparisons[propertyDescriptorName];
          if (propertyDescriptorComparison) {
            onComparisonDisplayed(propertyDescriptorComparison);
          }
        }
      }
    };

    const settleCounters = (comparison) => {
      const { counters } = comparison;
      const { self, inside, overall } = counters;
      self.any = self.modified + self.removed + self.added;
      inside.any = inside.modified + inside.removed + inside.added;
      overall.removed = self.removed + inside.removed;
      overall.added = self.added + inside.added;
      overall.modified = self.modified + inside.modified;
      overall.any = self.any + inside.any;

      comparison.removed = self.removed > 0;
      comparison.added = self.added > 0;
      comparison.modified = self.modified > 0;
    };
    const appendCounters = (counter, otherCounter) => {
      counter.any += otherCounter.any;
      counter.removed += otherCounter.removed;
      counter.added += otherCounter.added;
      counter.modified += otherCounter.modified;
    };

    const compare = (comparison, options = {}) => {
      // ignoreDiff is meant to ignore the diff between actual/expected
      // (usually because comparison cannot be made (added,removed, visiting something different))
      // but the structure still have to be visited (properties, values, valueOf, ...)
      const doCompare = () => {
        const { actualNode, expectedNode } = comparison;

        let ownerComparison;
        if (
          comparison.type === "property" ||
          comparison.type === "prototype" ||
          comparison.type === "indexed_value"
        ) {
          ownerComparison = comparison.parent;
        } else if (comparison.type === "property_descriptor") {
          ownerComparison = comparison.parent.parent;
        }

        const compareInside = (insideComparison, insideOptions = {}) => {
          compare(insideComparison, { ...options, ...insideOptions });
          if (insideComparison.counters.overall.any) {
            appendCounters(
              comparison.counters.inside,
              insideComparison.counters.overall,
            );
          }
        };

        if (ownerComparison) {
          if (
            ownerComparison.combinations.sets &&
            comparison.type === "indexed_value"
          ) {
            if (actualNode) {
              const added = !ownerComparison.expectedNode.value.has(
                actualNode.value,
              );
              if (added) {
                comparison.added = true;
              }
            } else {
              const removed = !ownerComparison.actualNode.value.has(
                expectedNode.value,
              );
              if (removed) {
                comparison.removed = true;
              }
            }
          } else if (!actualNode) {
            if (
              ownerComparison.actualNode &&
              ownerComparison.actualNode.canHaveProps
            ) {
              comparison.removed = true;
            }
          } else if (!expectedNode) {
            if (
              ownerComparison.expectedNode &&
              ownerComparison.expectedNode.canHaveProps
            ) {
              comparison.added = true;
            }
          }

          if (!comparison.hidden) {
            if (comparison.removed) {
              comparison.counters.self.removed++;
            } else if (comparison.added) {
              comparison.counters.self.added++;
            }
          }
        }

        if (comparison.type === "property") {
          const propertyDescriptorComparisons =
            comparison.childComparisons.propertyDescriptors;
          const visitPropertyDescriptor = (descriptorName) => {
            const actualPropertyDescriptorNode = actualNode
              ? actualNode.childNodes.propertyDescriptors[descriptorName]
              : null;
            const expectedPropertyDescriptorNode = expectedNode
              ? expectedNode.childNodes.propertyDescriptors[descriptorName]
              : null;
            if (
              !actualPropertyDescriptorNode &&
              !expectedPropertyDescriptorNode
            ) {
              return;
            }
            const propertyDescriptorComparison = createComparison(
              actualPropertyDescriptorNode,
              expectedPropertyDescriptorNode,
            );
            if (
              !actualPropertyDescriptorNode &&
              isDefaultDescriptor(
                descriptorName,
                expectedPropertyDescriptorNode.value,
              )
            ) {
              propertyDescriptorComparison.hidden = true;
            } else if (
              !expectedPropertyDescriptorNode &&
              isDefaultDescriptor(
                descriptorName,
                actualPropertyDescriptorNode.value,
              )
            ) {
              propertyDescriptorComparison.hidden = true;
            }
            propertyDescriptorComparisons[descriptorName] =
              propertyDescriptorComparison;
            compareInside(propertyDescriptorComparison);
            if (
              propertyDescriptorComparison.counters.overall.any === 0 &&
              actualPropertyDescriptorNode &&
              isDefaultDescriptor(
                descriptorName,
                actualPropertyDescriptorNode.value,
              ) &&
              expectedPropertyDescriptorNode &&
              isDefaultDescriptor(
                descriptorName,
                expectedPropertyDescriptorNode.value,
              )
            ) {
              propertyDescriptorComparison.hidden = true;
            }
          };
          visitPropertyDescriptor("value");
          visitPropertyDescriptor("enumerable");
          visitPropertyDescriptor("writable");
          visitPropertyDescriptor("configurable");
          visitPropertyDescriptor("set");
          visitPropertyDescriptor("get");
          return;
        }

        if (comparison.removed || comparison.added) {
          addCause(comparison);
        }

        const addSelfDiff = () => {
          if (!comparison.hidden) {
            comparison.counters.self.modified++;
          }
          addCause(comparison);
        };
        const addCategoryDiff = () => {
          comparison.category = true;
          if (
            actualNode &&
            actualNode.isUrlString &&
            expectedNode &&
            expectedNode.isUrlString
          ) {
            return;
          }
          addSelfDiff();
        };

        let ignoreReferenceDiff =
          options.ignoreDiff || !actualNode || !expectedNode;
        let ignoreCategoryDiff =
          options.ignoreDiff || !actualNode || !expectedNode;
        let ignorePrototypeDiff =
          options.ignoreDiff || !actualNode || !expectedNode;
        let ignoreInternalValueDiff =
          options.ignoreDiff || !actualNode || !expectedNode;

        reference: {
          if (ignoreReferenceDiff) {
            break reference;
          }
          const actualReferencePath = actualNode.reference
            ? actualNode.reference.path.toString()
            : null;
          const expectedReferencePath = expectedNode.reference
            ? expectedNode.reference.path.toString()
            : null;
          if (actualReferencePath !== expectedReferencePath) {
            comparison.reference = true;
            addSelfDiff();
          }
        }
        category: {
          if (ignoreCategoryDiff) {
            break category;
          }
          if (actualNode.wellKnownId !== expectedNode.wellKnownId) {
            addCategoryDiff();
            break category;
          }
          const actualIsPrimitive = actualNode.isPrimitive;
          const expectedIsPrimitive = expectedNode.isPrimitive;
          if (actualIsPrimitive !== expectedIsPrimitive) {
            addCategoryDiff();
            break category;
          }
          if (
            actualIsPrimitive &&
            expectedIsPrimitive &&
            actualNode.value !== expectedNode.value
          ) {
            addCategoryDiff();
            break category;
          }
          const actualIsComposite = actualNode.isComposite;
          const expectedIsComposite = expectedNode.isComposite;
          if (actualIsComposite !== expectedIsComposite) {
            addCategoryDiff();
            break category;
          }
          const actualSubtype = actualNode.subtype;
          const expectedSubtype = expectedNode.subtype;
          if (actualSubtype !== expectedSubtype) {
            addCategoryDiff();
            break category;
          }
        }
        inside: {
          prototype: {
            if (ignorePrototypeDiff) {
              break prototype;
            }
            const actualPrototypeNode = actualNode
              ? actualNode.childNodes.prototype
              : null;
            const expectedPrototypeNode = expectedNode
              ? expectedNode.childNodes.prototype
              : null;
            if (!actualPrototypeNode && !expectedPrototypeNode) {
              break prototype;
            }
            const prototypeComparison = createComparison(
              actualPrototypeNode,
              expectedPrototypeNode,
            );
            if (!actualPrototypeNode || !expectedPrototypeNode) {
              prototypeComparison.hidden = true;
            } else if (actualNode.subtype !== expectedNode.subtype) {
              // when we see a prefix like
              // actual: User {}
              // expect: Animal {}
              // we don't show the prototype
              prototypeComparison.hidden = true;
            }
            comparison.childComparisons.prototype = prototypeComparison;
            compareInside(prototypeComparison);
            if (prototypeComparison.counters.overall.any === 0) {
              prototypeComparison.hidden = true;
            }
          }
          internal_value: {
            if (ignoreInternalValueDiff) {
              break internal_value;
            }
            let actualInternalValueNode;
            let expectedInternalValueNode;
            if (comparison.combinations.primitiveAndComposite) {
              actualInternalValueNode = actualNode.childNodes.internalValue;
              expectedInternalValueNode = expectedNode.childNodes.internalValue;
            } else if (comparison.combinations.compositeAndNothing) {
              actualInternalValueNode = actualNode
                ? actualNode.childNodes.internalValue
                : null;
              expectedInternalValueNode = expectedNode
                ? expectedNode.childNodes.internalValue
                : null;
            } else if (comparison.combinations.composites) {
              actualInternalValueNode = actualNode.childNodes.internalValue;
              expectedInternalValueNode = expectedNode.childNodes.internalValue;
            }
            if (!actualInternalValueNode && !expectedInternalValueNode) {
              break internal_value;
            }

            const internalValueComparison = createComparison(
              actualInternalValueNode,
              expectedInternalValueNode,
            );
            if (actualInternalValueNode && expectedInternalValueNode) {
              if (
                actualInternalValueNode.origin === "valueOf()" &&
                expectedInternalValueNode.origin === "valueOf()"
              ) {
                if (
                  actualInternalValueNode.value === actualNode.value &&
                  expectedInternalValueNode.value === expectedNode.value
                ) {
                  internalValueComparison.hidden = true;
                } else if (actualNode.subtype === expectedNode.subtype) {
                  // valueOf differ but prototype is different so it's expected
                  const prototypeComparison =
                    comparison.childComparisons.prototype;
                  if (
                    prototypeComparison &&
                    prototypeComparison.counters.overall.any > 0
                  ) {
                    internalValueComparison.hidden = true;
                  }
                } else {
                  internalValueComparison.hidden = true;
                }
              }
            } else if (actualInternalValueNode) {
              if (
                actualInternalValueNode.origin === "valueOf()" &&
                actualInternalValueNode.value === actualNode.value
              ) {
                internalValueComparison.hidden = true;
              }
            } else if (expectedInternalValueNode) {
              if (
                expectedInternalValueNode.origin === "valueOf()" &&
                expectedInternalValueNode.value === expectedNode.value
              ) {
                internalValueComparison.hidden = true;
              }
            }
            comparison.childComparisons.internalValue = internalValueComparison;
            compareInside(internalValueComparison);
          }

          string: {
            lines: {
              const actualLineNodes = actualNode
                ? actualNode.childNodes.lines || []
                : [];
              const expectedLineNodes = expectedNode
                ? expectedNode.childNodes.lines || []
                : [];
              const lineComparisons = comparison.childComparisons.lines;

              const visitLineNode = (lineNode) => {
                const lineIndex = lineNode.index;
                const actualLineNode = actualLineNodes[lineIndex];
                const expectedLineNode = expectedLineNodes[lineIndex];
                const lineComparison = createComparison(
                  actualLineNode,
                  expectedLineNode,
                );
                lineComparisons[lineIndex] = lineComparison;
                compareInside(lineComparison);
              };
              for (const actualLineNode of actualLineNodes) {
                visitLineNode(actualLineNode);
              }
              for (const expectedLineNode of expectedLineNodes) {
                if (!lineComparisons[expectedLineNode.index]) {
                  visitLineNode(expectedLineNode);
                }
              }
            }
            chars: {
              const actualCharNodes = actualNode
                ? actualNode.childNodes.chars || []
                : [];
              const expectedCharNodes = expectedNode
                ? expectedNode.childNodes.chars || []
                : [];
              const charComparisons = comparison.childComparisons.chars;

              const visitCharNode = (charNode) => {
                const charNodeIndex = charNode.index;
                const actualCharNode = actualCharNodes[charNodeIndex];
                const expectedCharNode = expectedCharNodes[charNodeIndex];
                const charComparison = createComparison(
                  actualCharNode,
                  expectedCharNode,
                );
                charComparisons[charNodeIndex] = charComparison;
                compareInside(charComparison);
              };
              for (const actualCharNode of actualCharNodes) {
                visitCharNode(actualCharNode);
              }
              for (const expectedCharNode of expectedCharNodes) {
                if (!charComparisons[expectedCharNode.index]) {
                  visitCharNode(expectedCharNode);
                }
              }
            }
          }
          url_parts: {
            const actualUrlPartNodes = actualNode
              ? actualNode.childNodes.urlParts || {}
              : {};
            const expectedUrlPartNodes = expectedNode
              ? expectedNode.childNodes.urlParts || {}
              : {};

            const urlPartComparisons = comparison.childComparisons.urlParts;
            const visitUrlPart = (urlPartName) => {
              const actualUrlPartNode = actualUrlPartNodes[urlPartName];
              const expectedUrlPartNode = expectedUrlPartNodes[urlPartName];
              const urlPartComparison = createComparison(
                actualUrlPartNode,
                expectedUrlPartNode,
              );
              urlPartComparisons[urlPartName] = urlPartComparison;
              compareInside(urlPartComparison);
            };
            for (const actualUrlPartName of Object.keys(actualUrlPartNodes)) {
              visitUrlPart(actualUrlPartName);
            }
            for (const expectedUrlPartName of Object.keys(
              expectedUrlPartNodes,
            )) {
              if (!urlPartComparisons[expectedUrlPartName]) {
                visitUrlPart(expectedUrlPartName);
              }
            }
          }
          indexed_values: {
            const actualIndexedValueNodes = actualNode
              ? actualNode.childNodes.indexedValues || []
              : [];
            const expectedIndexedValueNodes = expectedNode
              ? expectedNode.childNodes.indexedValues || []
              : [];
            const indexedValueComparisons =
              comparison.childComparisons.indexedValues;

            if (comparison.combinations.sets) {
              let index = 0;
              const visitSetValue = (
                actualIndexedValueNode,
                expectedIndexedValueNode,
              ) => {
                const indexedValueComparison = createComparison(
                  actualIndexedValueNode,
                  expectedIndexedValueNode,
                );
                indexedValueComparison.index = index;
                indexedValueComparisons[index] = indexedValueComparison;
                index++;
                compareInside(indexedValueComparison);
              };
              for (const actualIndexedValueNode of actualIndexedValueNodes) {
                visitSetValue(actualIndexedValueNode, null);
              }
              for (const expectedIndexedValueNode of expectedIndexedValueNodes) {
                visitSetValue(null, expectedIndexedValueNode);
              }
              break indexed_values;
            }

            const visitIndexedValue = (indexedValueNode) => {
              const index = indexedValueNode.index;
              const actualIndexedValueNode = actualIndexedValueNodes[index];
              const expectedIndexedValueNode = expectedIndexedValueNodes[index];
              const indexedValueComparison = createComparison(
                actualIndexedValueNode,
                expectedIndexedValueNode,
              );
              indexedValueComparisons[index] = indexedValueComparison;
              compareInside(indexedValueComparison);
            };
            for (const expectedIndexedValueNode of expectedIndexedValueNodes) {
              visitIndexedValue(expectedIndexedValueNode);
            }
            for (const actualIndexedValueNode of actualIndexedValueNodes) {
              if (!indexedValueComparisons[actualIndexedValueNode.index]) {
                visitIndexedValue(actualIndexedValueNode);
              }
            }
          }
          properties: {
            const actualPropertyNodes = actualNode
              ? actualNode.childNodes.properties || {}
              : {};
            const expectedPropertyNodes = expectedNode
              ? expectedNode.childNodes.properties || {}
              : {};
            const propertyComparisons = comparison.childComparisons.properties;

            const visitProperty = (property) => {
              // hasOwn here because childNode.properties is an object inheriting Object.prototype
              // so node.childNodes.properties.constructor is returning a function
              // when we want null (if the object has no custom "constructor" property)
              const actualPropertyNode = Object.hasOwn(
                actualPropertyNodes,
                property,
              )
                ? actualPropertyNodes[property]
                : null;
              const expectedPropertyNode = Object.hasOwn(
                expectedPropertyNodes,
                property,
              )
                ? expectedPropertyNodes[property]
                : null;
              const propertyNodeComparison = createComparison(
                actualPropertyNode,
                expectedPropertyNode,
              );
              propertyComparisons[property] = propertyNodeComparison;
              compareInside(propertyNodeComparison);
            };
            for (const actualPropertyName of Object.keys(actualPropertyNodes)) {
              visitProperty(actualPropertyName);
            }
            for (const expectedPropertyName of Object.keys(
              expectedPropertyNodes,
            )) {
              if (!propertyComparisons[expectedPropertyName]) {
                visitProperty(expectedPropertyName);
              }
            }
          }
        }
      };

      doCompare();
      settleCounters(comparison);
    };
    const createComparison = (
      actualNode,
      expectedNode,
      { fromInternalValue } = {},
    ) => {
      let mainNode;
      if (fromInternalValue) {
        if (actualNode && actualNode.isComposite) {
          mainNode = actualNode;
        } else if (expectedNode && expectedNode.isComposite) {
          mainNode = expectedNode;
        } else {
          mainNode = actualNode || expectedNode;
        }
      } else {
        mainNode = actualNode || expectedNode;
        if (actualNode && actualNode.comparison) {
          throw new Error("nope");
        } else if (expectedNode && expectedNode.comparison) {
          throw new Error("nope");
        }
      }

      const parent = mainNode.parent ? mainNode.parent.comparison : null;

      const comparison = {
        combinations: {
          primitives:
            actualNode &&
            expectedNode &&
            actualNode.isPrimitive &&
            expectedNode.isPrimitive,
          composites:
            actualNode &&
            expectedNode &&
            actualNode.isComposite &&
            expectedNode.isComposite,
          sets:
            actualNode &&
            expectedNode &&
            actualNode.isSet &&
            expectedNode.isSet,
          primitiveAndNothing:
            (actualNode && actualNode.isPrimitive && !expectedNode) ||
            (!actualNode && expectedNode && expectedNode.isPrimitive),
          compositeAndNothing:
            (actualNode && actualNode.isComposite && !expectedNode) ||
            (!actualNode && expectedNode && expectedNode.isComposite),
          primitiveAndComposite:
            actualNode &&
            expectedNode &&
            actualNode.isComposite !== expectedNode.isComposite,
        },
        parent,
        type: mainNode.type,
        depth: mainNode.depth,
        path: mainNode.path,
        property: mainNode.property,
        descriptor: mainNode.descriptor,
        index: mainNode.index,

        actualNode,
        expectedNode,
        counters: {
          overall: {
            any: 0,
            modified: 0,
            removed: 0,
            added: 0,
          },
          self: {
            any: 0,
            modified: 0,
            removed: 0,
            added: 0,
          },
          inside: {
            any: 0,
            modified: 0,
            removed: 0,
            added: 0,
          },
        },
        hidden: false,
        removed: false,
        added: false,
        modified: false,
        // comparisons
        reference: false,
        category: false,
        childComparisons: {
          prototype: null,
          internalValue: null,
          properties: {},
          propertyDescriptors: {},
          indexedValues: [],
          lines: [],
          chars: [],
          urlParts: {},
        },
      };

      if (fromInternalValue) {
        if (actualNode && actualNode.type === "internal_value") {
          actualNode.comparison = comparison;
        }
        if (expectedNode && expectedNode.type === "internal_value") {
          expectedNode.comparison = comparison;
        }
      } else {
        if (actualNode) {
          actualNode.comparison = comparison;
        }
        if (expectedNode) {
          expectedNode.comparison = comparison;
        }
      }

      return comparison;
    };

    const rootComparison = createComparison(actualNode, expectedNode);
    compare(rootComparison);
    for (const causeComparison of causeSet) {
      if (causeComparison.type === "property_descriptor") {
        let current = causeComparison.parent.parent;
        while (current) {
          if (current.counters.self.any) {
            removeCause(causeComparison);
            break;
          }
          current = current.parent;
        }
      }
    }
    if (causeSet.size === 0) {
      return;
    }

    let startComparison = rootComparison;
    start_on_max_depth: {
      if (rootComparison.category) {
        break start_on_max_depth;
      }
      const [firstComparisonCausingDiff] = causeSet;
      if (firstComparisonCausingDiff.depth < maxDepth) {
        break start_on_max_depth;
      }
      const comparisonsFromRootToTarget = [firstComparisonCausingDiff];
      let currentComparison = firstComparisonCausingDiff;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const parentComparison = currentComparison.parent;
        if (parentComparison) {
          comparisonsFromRootToTarget.unshift(parentComparison);
          currentComparison = parentComparison;
        } else {
          break;
        }
      }
      let startComparisonDepth = firstComparisonCausingDiff.depth - maxDepth;
      for (const comparison of comparisonsFromRootToTarget) {
        if (
          comparison.type === "property_descriptor" &&
          comparison.depth > startComparisonDepth
        ) {
          startComparison = comparison;
          break;
        }
      }
    }

    const actualValueMeta = {
      resultType: "actualNode",
      name: "actual",
      shortname: "actual",
      color: unexpectedColor,
    };
    const expectedValueMeta = {
      resultType: "expectedNode",
      name: "expected",
      shortname: "expect",
      color: expectedColor,
    };
    const firstValueMeta = actualIsFirst ? actualValueMeta : expectedValueMeta;
    const secondValueMeta = actualIsFirst ? expectedValueMeta : actualValueMeta;

    // si le start node a une diff alors il faudrait lui mettre le signe + devant actual
    const displayedIdMap = new Map();
    let idCount = 0;
    const getDisplayedId = (nodeId) => {
      const existingId = displayedIdMap.get(nodeId);
      if (existingId) {
        return existingId;
      }
      const idDisplayed = idCount + 1;
      idCount++;
      displayedIdMap.set(nodeId, idDisplayed);
      return idDisplayed;
    };

    const contextBase = {
      onComparisonDisplayed,
      getDisplayedId,
      startComparison,
      signs,
      initialDepth: -startComparison.depth,
      maxColumns,
      maxDepth,
      maxDiffPerObject,
      maxValueBeforeDiff,
      maxValueAfterDiff,
      maxValueInsideDiff,
      maxDepthInsideDiff,
      maxLineBeforeDiff,
      maxLineAfterDiff,
      quote,
      preserveLineBreaks,
    };

    let firstPrefix = "";
    let firstValueDiff;
    actual_diff: {
      firstPrefix += ANSI.color(firstValueMeta.shortname, sameColor);
      firstPrefix += ANSI.color(":", sameColor);
      firstPrefix += " ";
      firstValueDiff = writeDiff(startComparison, {
        ...contextBase,
        resultType: firstValueMeta.resultType,
        textIndent: stringWidth(firstPrefix),
      });
    }
    let secondPrefix = "";
    let secondValueDiff;
    expected_diff: {
      secondPrefix += ANSI.color(secondValueMeta.shortname, sameColor);
      secondPrefix += ANSI.color(":", sameColor);
      secondPrefix += " ";
      secondValueDiff = writeDiff(startComparison, {
        ...contextBase,
        resultType: secondValueMeta.resultType,
        textIndent: stringWidth(secondPrefix),
      });
    }

    let diffMessage = "";
    diffMessage += firstPrefix;
    diffMessage += firstValueDiff;
    diffMessage += "\n";
    diffMessage += secondPrefix;
    diffMessage += secondValueDiff;

    let message;
    if (rootComparison.category) {
      message = `${ANSI.color(firstValueMeta.name, firstValueMeta.color)} and ${ANSI.color(secondValueMeta.name, secondValueMeta.color)} are different`;
    } else {
      message = `${ANSI.color(firstValueMeta.name, firstValueMeta.color)} and ${ANSI.color(secondValueMeta.name, secondValueMeta.color)} have ${causeCounters.total} ${causeCounters.total === 1 ? "difference" : "differences"}`;
    }
    message += ":";
    message += "\n\n";
    const infos = [];
    const diffNotDisplayed = causeCounters.total - causeCounters.displayed;
    if (diffNotDisplayed) {
      if (diffNotDisplayed === 1) {
        infos.push(`to improve readability 1 diff is completely hidden`);
      } else {
        infos.push(
          `to improve readability ${diffNotDisplayed} diffs are completely hidden`,
        );
      }
    }
    if (startComparison !== rootComparison) {
      infos.push(
        `diff starts at ${ANSI.color(startComparison.path, ANSI.YELLOW)}`,
      );
    }
    if (infos.length) {
      for (const info of infos) {
        message += `${UNICODE.INFO} ${info}`;
        message += "\n";
      }
      message += "\n";
    }
    message += `${diffMessage}`;

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

let createValueNode;
{
  let nodeId = 1;
  createValueNode = ({ name, value, getReference }) => {
    const _createValueNode = ({ parent, path, type, value, origin }) => {
      const node = {
        name,
        id: nodeId++,
        path,
      };

      info: {
        let composite = false;
        let wellKnownId;
        let subtype;
        let isArray = false;
        let isSet = false;
        let isString = false;
        let isStringObject = false;
        let isUrl = false;
        let isUrlString = false;
        let reference = null;
        if (value === ARRAY_EMPTY_VALUE) {
          wellKnownId = "empty";
          subtype = "empty";
        } else if (type === "property") {
        }
        // else if (value === DOES_NOT_EXISTS) {
        //   composite = false;
        //   isArray = false;
        //   wellKnownId = "not_found";
        //   subtype = "not_found";
        // }
        else {
          composite = isComposite(value);
          wellKnownId = getWellKnownId(value);
          if (composite) {
            subtype = getSubtype(value);
            reference =
              wellKnownId || type === "prototype"
                ? null
                : getReference(value, node);
            visitPrototypes(value, (proto) => {
              if (proto.constructor) {
                if (proto.constructor.name === "Array") {
                  isArray = true;
                } else if (proto.constructor.name === "Set") {
                  isSet = true;
                } else if (proto.constructor.name === "String") {
                  isStringObject = true;
                } else if (proto.constructor.name === "URL") {
                  isUrl = true;
                }
              }
            });
          } else if (value === null) {
            subtype = "null";
          } else {
            subtype = typeof value;
            if (subtype === "string") {
              isString = true;
              isUrlString = canParseUrl(value);
            }
          }
        }
        const canHaveIndexedValues = isArray || isSet;
        const canHaveLines =
          (isString || isStringObject) && type !== "line" && type !== "char";
        // const canHaveChars = isString && type !== "char";
        const canHaveChars =
          // isString is important because value can be undefined, for example when:
          // - actual is not a string and expected is
          // - actual string is shorter
          // - ...
          isString && type === "line";
        const canHaveProps = composite;
        let inConstructor;
        if (type === "internal_value") {
          if (origin === "valueOf()") {
            // we display in constructor if parent subtype is not Object nor Array
            // (if there is a constructor displayed)
            const parentSubtype = parent.subtype;
            if (parentSubtype !== "Object" && parentSubtype !== "Array") {
              inConstructor = true;
            }
          } else if (origin === "href") {
            if (parent.isUrl) {
              inConstructor = true;
            }
          }
        }

        let depth;
        if (parent) {
          if (type === "property") {
            depth = parent.depth;
          } else if (type === "internal_value") {
            if (inConstructor) {
              depth = parent.depth;
            } else if (origin) {
              depth = parent.depth + 1;
            } else {
              depth = parent.depth;
            }
          } else if (type === "url_part") {
            depth = parent.depth;
          } else {
            depth = parent.depth + 1;
          }
        } else {
          depth = 0;
        }
        Object.assign(node, {
          parent,
          depth,
          type,
          value,
          valueOf: () => {
            throw new Error(`use ${name}.value`);
          },
          origin,
          subtype,
          isComposite: composite,
          isPrimitive: !composite,
          isString,
          isArray,
          isSet,
          isUrl,
          isUrlString,
          canHaveIndexedValues,
          canHaveLines,
          canHaveChars,
          canHaveProps,
          wellKnownId,
          inConstructor,
          reference,
          referenceFromOthersSet: new Set(),
          keys: [],
        });
      }

      const childNodes = {
        prototype: null,
        internalValue: null,
        properties: {},
        propertyDescriptors: {},
        indexedValues: [],
        lines: [],
        chars: [],
      };
      node.childNodes = childNodes;

      node.structureIsKnown = Boolean(node.wellKnownId || node.reference);
      // prototype
      if (node.isComposite && !node.structureIsKnown) {
        const prototypeNode = _createValueNode({
          parent: node,
          path: path.append("__proto__"),
          type: "prototype",
          value: Object.getPrototypeOf(node.value),
        });
        childNodes.prototype = prototypeNode;
      }
      // internal value (.valueOf(), .href, .toString())
      if (
        node.isComposite &&
        !node.structureIsKnown &&
        "valueOf" in node.value &&
        typeof node.value.valueOf === "function" &&
        node.value.valueOf !== Object.prototype.valueOf
      ) {
        const internalValue = node.value.valueOf();
        const internalValueNode = _createValueNode({
          parent: node,
          path: path.append("valueOf()"),
          type: "internal_value",
          value: internalValue,
          origin: "valueOf()",
        });
        childNodes.internalValue = internalValueNode;
      } else if (node.isUrl) {
        const internalValue = node.href;
        const internalValueNode = _createValueNode({
          parent: node,
          path: path.append("href"),
          type: "internal_value",
          value: internalValue,
          origin: "href",
        });
        childNodes.internalValue = internalValueNode;
      }

      // properties
      if (node.isComposite && !node.structureIsKnown) {
        const propertyNodes = {};
        const keys = [];

        const shouldIgnoreProperty = (propertyName) => {
          if (node.isArray) {
            if (propertyName === "length") {
              return true;
            }
            if (isArrayIndex(propertyName)) {
              return true;
            }
          }
          if (node.isComposite && node.subtype === "String") {
            if (propertyName === "length") {
              return true;
            }
            if (isArrayIndex(propertyName)) {
              return true;
            }
          }
          // if (valueInfo.isUrl) {
          //   if (property === "href" && node.canDiffUrlParts) {
          //     return true;
          //   }
          //   if (
          //     [
          //       "origin",
          //       "host",

          //       "protocol",
          //       "hostname",
          //       "username",
          //       "password",
          //       "pathname",
          //       "search",
          //       "searchParams",
          //       "hash",
          //     ].includes(property)
          //   ) {
          //     return true;
          //   }
          // }
          if (
            propertyName === "valueOf" &&
            node.childNodes.internalValue &&
            node.childNodes.internalValue.origin === "valueOf()"
          ) {
            return true;
          }
          if (
            propertyName === "toString" &&
            node.childNodes.internalValue &&
            node.childNodes.internalValue.origin === "toString()"
          ) {
            return true;
          }
          return false;
        };
        const propertyNames = Object.getOwnPropertyNames(node.value);
        for (const propertyName of propertyNames) {
          if (shouldIgnoreProperty(propertyName)) {
            continue;
          }
          keys.push(propertyName);

          const propertyDescriptor = Object.getOwnPropertyDescriptor(
            node.value,
            propertyName,
          );
          const propertyNode = _createValueNode({
            parent: node,
            path: path.append(propertyName),
            type: "property",
            value: propertyDescriptor,
          });
          propertyNode.property = propertyName;
          const propertyDescriptorNodes = {
            value: null,
            enumerable: null,
            writable: null,
            configurable: null,
            set: null,
            get: null,
          };
          for (const propertyDescriptorName of Object.keys(
            propertyDescriptor,
          )) {
            const propertyDescriptorValue =
              propertyDescriptor[propertyDescriptorName];
            const propertyDescriptorNode = _createValueNode({
              parent: propertyNode,
              path:
                propertyDescriptorName === "value"
                  ? propertyNode.path
                  : propertyNode.path.append(propertyDescriptorName, {
                      isPropertyDescriptor: true,
                    }),
              type: "property_descriptor",
              value: propertyDescriptorValue,
            });
            propertyDescriptorNode.property = propertyName;
            propertyDescriptorNode.descriptor = propertyDescriptorName;
            propertyDescriptorNodes[propertyDescriptorName] =
              propertyDescriptorNode;
          }
          propertyNode.childNodes.propertyDescriptors = propertyDescriptorNodes;
          propertyNodes[propertyName] = propertyNode;
        }

        childNodes.properties = propertyNodes;
        node.keys = keys;
      }
      // indexed_values
      if (node.canHaveIndexedValues && !node.structureIsKnown) {
        const indexedValueNodes = [];

        if (node.isSet) {
          let index = 0;
          for (const setValue of node.value) {
            const setValueNode = _createValueNode({
              parent: node,
              path: path.append(index),
              type: "indexed_value",
              value: setValue,
            });
            setValueNode.index = index;
            indexedValueNodes[index] = setValueNode;
            index++;
          }
        } else {
          let index = 0;
          for (const value of node.value) {
            const indexedValueNode = _createValueNode({
              parent: node,
              path: path.append(index),
              type: "indexed_value",
              value: Object.hasOwn(node.value, index)
                ? value
                : ARRAY_EMPTY_VALUE,
            });
            indexedValueNode.index = index;
            indexedValueNodes[index] = indexedValueNode;
            index++;
          }
        }

        childNodes.indexedValues = indexedValueNodes;
      }
      // string (lines and chars)
      if (node.canHaveLines && !node.structureIsKnown) {
        const lineNodes = [];

        const lines = node.value.split(/\r?\n/);
        for (const line of lines) {
          const lineNode = _createValueNode({
            parent: node,
            path,
            type: "line",
            value: line,
          });
          const lineNodeIndex = lineNodes.length;
          lineNode.index = lineNodeIndex;
          lineNodes[lineNodeIndex] = lineNode;
        }

        childNodes.lines = lineNodes;
      }
      if (node.canHaveChars && !node.structureIsKnown) {
        const charNodes = [];

        const chars = splitChars(node.value);
        for (const char of chars) {
          const charNode = _createValueNode({
            parent: node,
            path,
            type: "char",
            value: char,
          });
          const charNodeIndex = charNodes.length;
          charNode.index = charNodeIndex;
          charNodes[charNodeIndex] = charNode;
        }

        childNodes.chars = charNodes;
      }
      // url parts
      if ((node.isUrl || node.isUrlString) && !node.structureIsKnown) {
        const urlPartNodes = {};

        const urlParts = node.isUrl ? node.value : new URL(node.value);
        for (const urlPartName of URL_PART_NAMES) {
          const urlPartValue = urlParts[urlPartName];
          const urlPartNode = _createValueNode({
            parent: node,
            path,
            type: "url_part",
            value: normalizeUrlPart(urlPartName, urlPartValue),
          });
          urlPartNode.urlPartName = urlPartName;
          urlPartNodes[urlPartName] = urlPartNode;
        }

        childNodes.urlParts = urlPartNodes;
      }

      return node;
    };

    const valueNode = _createValueNode({
      path: createValuePath(),
      type: "value",
      value,
    });
    return valueNode;
  };

  const visitPrototypes = (obj, callback) => {
    while (obj || isUndetectableObject(obj)) {
      const proto = Object.getPrototypeOf(obj);
      if (!proto) {
        break;
      }
      callback(proto);
      obj = proto;
    }
  };
  const getSubtype = (obj) => {
    // https://github.com/nodejs/node/blob/384fd1787634c13b3e5d2f225076d2175dc3b96b/lib/internal/util/inspect.js#L859
    const tag = obj[Symbol.toStringTag];
    if (typeof tag === "string") {
      return tag;
    }

    while (obj || isUndetectableObject(obj)) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, "constructor");
      if (
        descriptor !== undefined &&
        typeof descriptor.value === "function" &&
        descriptor.value.name !== ""
      ) {
        return String(descriptor.value.name);
      }
      obj = Object.getPrototypeOf(obj);
      if (obj === null) {
        return "Object";
      }
    }
    return "";
  };
  const isUndetectableObject = (v) =>
    typeof v === "undefined" && v !== undefined;

  // we could also just do sthing like if (indexedValues[property]) ?
  const isArrayIndex = (property) => {
    if (property === "NaN") {
      return false;
    }
    const asNumber = parseInt(property);
    if (asNumber < 0) {
      return false;
    }
    if (asNumber > 4_294_967_294) {
      return false;
    }
    if (asNumber % 1 !== 0) {
      // float
      return false;
    }
    return true;
  };

  const normalizeUrlPart = (name, value) => {
    if (name === "port") {
      if (value === "") {
        return "";
      }
      return parseInt(value);
    }
    if (name === "search") {
      return value.slice(1);
    }
    return value;
  };

  const URL_PART_NAMES = [
    "protocol",
    "username",
    "password",
    "hostname",
    "port",
    "pathname",
    // for search params I'll have to think about it
    // for now we'll handle it as a string
    "search",
    "hash",
  ];
}

let writeDiff;
{
  writeDiff = (comparison, context) => {
    if (comparison.hidden) {
      return "";
    }
    context.onComparisonDisplayed(comparison);
    const node = comparison[context.resultType];
    const selfModified =
      context.modified || comparison.counters.self.modified > 0;
    const selfContext = {
      ...context,
      modified: selfModified,
      added: selfModified
        ? false
        : context.added || comparison.counters.self.added > 0,
      removed: selfModified
        ? false
        : context.removed || comparison.counters.self.removed > 0,
    };

    let diff = "";
    let displayValue = true;

    let endSeparator;
    const delimitersColor = getDelimitersColor(selfContext, comparison);
    let isNestedValue =
      node.type === "indexed_value" ||
      node.type === "property_descriptor" ||
      node.type === "prototype" ||
      node.type === "internal_value";
    let property =
      node.type === "property_descriptor"
        ? node.property
        : node.type === "prototype"
          ? "__proto__" // "[[Prototype]]"?
          : node.type === "internal_value"
            ? node.origin
            : "";

    if (node.type === "internal_value" && node.inConstructor) {
      isNestedValue = false;
      property = "";
    }

    if (isNestedValue) {
      let useIndent;
      const relativeDepth = node.depth + selfContext.initialDepth;
      if (context.collapsed) {
        useIndent = false;
        selfContext.insideOverview = false;
      } else {
        useIndent = true;
        if (relativeDepth >= selfContext.maxDepth) {
          selfContext.collapsed = true;
          selfContext.insideOverview = true;
        } else if (comparison.counters.overall.any === 0) {
          selfContext.collapsed = true;
          selfContext.insideOverview = true;
        }
      }

      if (useIndent) {
        let indent = `  `.repeat(relativeDepth);
        if (selfContext.signs) {
          if (selfContext.removed) {
            if (selfContext.resultType === "expectedNode") {
              diff += ANSI.color(removedSign, removedSignColor);
              indent = indent.slice(1);
            }
          } else if (selfContext.added) {
            if (selfContext.resultType === "actualNode") {
              diff += ANSI.color(addedSign, addedSignColor);
              indent = indent.slice(1);
            }
          } else if (selfContext.modified) {
            if (selfContext.resultType === "actualNode") {
              diff += ANSI.color(unexpectedSign, unexpectedSignColor);
              indent = indent.slice(1);
            }
          }
        }
        diff += indent;
      }

      if (property && comparison !== selfContext.startComparison) {
        let keyColor;
        if (context.added) {
          keyColor = addedColor;
        } else if (context.removed) {
          keyColor = removedColor;
        } else if (context.modified) {
          keyColor =
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
        } else {
          keyColor = sameColor;
        }
        if (
          node.type === "property_descriptor" &&
          node.descriptor !== "value"
        ) {
          diff += ANSI.color(node.descriptor, keyColor);
          diff += " ";
        }
        const propertyKeyFormatted = humanizePropertyKey(property);
        diff += ANSI.color(propertyKeyFormatted, keyColor);
        if (displayValue) {
          diff += ANSI.color(":", keyColor);
          diff += " ";
        }
      }
      if (node.canHaveLines && node.childNodes.lines.length > 1) {
        // when using
        // foo: 1| line 1
        //      2| line 2
        //      3| line 3
        // the "," separator is removed because it's not correctly separated from the multiline
        // and it becomes hard to know if "," is part of the string or not
        endSeparator = "";
      } else if (useIndent && comparison !== selfContext.startComparison) {
        endSeparator = ",";
      } else {
        endSeparator = "";
      }
      if (displayValue) {
        selfContext.textIndent += stringWidth(diff);
        selfContext.maxColumns -= endSeparator.length;
        if (selfContext.modified) {
          selfContext.maxDepth = Math.min(
            node.depth + selfContext.maxDepthInsideDiff,
            selfContext.maxDepth,
          );
        }
      }
    }

    value: {
      if (!displayValue) {
        break value;
      }

      if (selfContext.collapsed) {
        if (node.type === "property") {
          const propertyDescriptorComparisons =
            comparison.childComparisons.propertyDescriptors;
          const propertyGetterComparison = propertyDescriptorComparisons.get;
          const propertySetterComparison = propertyDescriptorComparisons.set;
          const propertyGetterNode = propertyGetterComparison
            ? propertyGetterComparison[selfContext.resultType]
            : null;
          const propertySetterNode = propertySetterComparison
            ? propertySetterComparison[selfContext.resultType]
            : null;
          if (propertyGetterNode && propertySetterNode) {
            diff += writeDiff(propertyGetterComparison, selfContext);
            break value;
          }
          if (propertyGetterNode) {
            diff += writeDiff(propertyGetterComparison, selfContext);
            break value;
          }
          if (propertySetterNode) {
            diff += writeDiff(propertySetterComparison, selfContext);
            break value;
          }
          const propertyValueComparison = propertyDescriptorComparisons.value;
          diff += writeDiff(propertyValueComparison, selfContext);
          break value;
        }
        if (node.type === "property_descriptor") {
          if (node.descriptor === "get") {
            const valueColor = getValueColor(selfContext, comparison);
            const setterNode = node.parent.childNodes.propertyDescriptors.set;
            if (setterNode && setterNode.value) {
              diff += ANSI.color("[get/set]", valueColor);
              break value;
            }
            diff += ANSI.color("[get]", valueColor);
            break value;
          }
          if (node.descriptor === "set") {
            const valueColor = getValueColor(selfContext, comparison);
            const getterNode = node.parent.childNodes.propertyDescriptors.get;
            if (getterNode && getterNode.value) {
              diff += ANSI.color("[get/set]", valueColor);
            } else {
              diff += ANSI.color("[set]", valueColor);
            }
            break value;
          }
        }
      }
      if (node.type === "property") {
        const propertyDescriptorComparisons =
          comparison.childComparisons.propertyDescriptors;
        let propertyDiff = "";
        const propertyDescriptorNames = Object.keys(
          propertyDescriptorComparisons,
        );
        for (const propertyDescriptorName of propertyDescriptorNames) {
          const propertyDescriptorComparison =
            propertyDescriptorComparisons[propertyDescriptorName];
          if (propertyDescriptorComparison) {
            propertyDiff += writeDiff(
              propertyDescriptorComparison,
              selfContext,
            );
          }
        }
        diff += propertyDiff;
        break value;
      }
      if (node.wellKnownId) {
        const valueColor = getValueColor(selfContext, comparison);
        diff += ANSI.color(node.wellKnownId, valueColor);
        break value;
      }
      if (node.isPrimitive && !node.isUrlString) {
        if (node.canHaveLines) {
          diff += writeLinesDiff(comparison, selfContext);
          break value;
        }
        if (node.isString) {
          diff += writeCharDiff(comparison, selfContext);
          break value;
        }

        const value = node.value;
        let valueDiff =
          value === undefined
            ? "undefined"
            : value === null
              ? "null"
              : JSON.stringify(value);
        if (
          valueDiff.length >
          selfContext.maxColumns - selfContext.textIndent
        ) {
          valueDiff = valueDiff.slice(
            0,
            selfContext.maxColumns - selfContext.textIndent - "…".length,
          );
          valueDiff += "…";
        }
        const valueColor = getValueColor(selfContext, comparison);
        diff += ANSI.color(valueDiff, valueColor);
        break value;
      }

      reference: {
        // referencing an other composite
        if (node.reference) {
          diff += ANSI.color(
            `<ref #${selfContext.getDisplayedId(node.reference.id)}>`,
            delimitersColor,
          );
          break value;
        }
        // will be referenced by a composite
        let referenceFromOtherDisplayed;
        for (const referenceFromOther of node.referenceFromOthersSet) {
          const referenceFromOtherComparison = referenceFromOther.comparison;
          if (
            !referenceFromOtherComparison ||
            referenceFromOtherComparison.hidden
          ) {
            continue;
          }
          referenceFromOtherDisplayed = referenceFromOther;
          break;
        }
        if (referenceFromOtherDisplayed) {
          diff += ANSI.color(
            `<ref #${selfContext.getDisplayedId(
              referenceFromOtherDisplayed.reference.id,
            )}>`,
            delimitersColor,
          );
          diff += " ";
        }
      }

      // composite collapsed with overview
      if (selfContext.collapsed && selfContext.insideOverview) {
        const prefixWithOverview = writePrefix(comparison, selfContext, {
          overview: true,
        });
        const bracketColor = getBracketColor(selfContext, comparison);
        const valueColor = getValueColor(selfContext, comparison);
        const {
          openBracket,
          closeBracket,
          nestedValueSeparator,
          nestedValueSpacing,
          ellipsis,
        } = getDelimiters(comparison, selfContext);

        const estimatedCollapsedBoilerplate = `${prefixWithOverview} ${openBracket}${nestedValueSeparator} ${ellipsis}${closeBracket}`;
        const estimatedCollapsedBoilerplateWidth = stringWidth(
          estimatedCollapsedBoilerplate,
        );
        const remainingWidth =
          selfContext.maxColumns -
          selfContext.textIndent -
          estimatedCollapsedBoilerplateWidth;

        let insideOverview = "";
        let isFirst = true;
        let width = 0;
        let nestedComparison;
        const next = createGetNextNestedValue(comparison, selfContext);
        while ((nestedComparison = next())) {
          let valueOverview = "";
          valueOverview += writeDiff(nestedComparison, selfContext);
          const valueWidth = stringWidth(valueOverview);
          if (width + valueWidth > remainingWidth) {
            let overviewTruncated = "";
            overviewTruncated += prefixWithOverview;
            overviewTruncated += " ";
            overviewTruncated += ANSI.color(openBracket, delimitersColor);
            if (insideOverview) {
              overviewTruncated += " ";
              overviewTruncated += insideOverview;
              if (nestedValueSeparator) {
                overviewTruncated += ANSI.color(
                  nestedValueSeparator,
                  delimitersColor,
                );
                if (nestedValueSpacing) {
                  overviewTruncated += " ";
                }
              }
            }
            overviewTruncated += ANSI.color(ellipsis, valueColor);
            if (nestedValueSpacing) {
              overviewTruncated += " ";
            }
            overviewTruncated += ANSI.color(closeBracket, delimitersColor);
            diff += overviewTruncated;
            break value;
          }
          if (nestedValueSeparator) {
            if (isFirst) {
              isFirst = false;
            } else {
              insideOverview += ANSI.color(
                nestedValueSeparator,
                delimitersColor,
              );
              width += nestedValueSeparator.length;
              if (nestedValueSpacing) {
                insideOverview += " ";
                width += " ".length;
              }
            }
          }
          insideOverview += valueOverview;
          width += valueWidth;
        }

        let overview = "";
        const prefix = writePrefix(comparison, context);
        overview += prefix;

        let afterPrefix = "";
        const shouldDisplayBrackets = prefix ? insideOverview.length > 0 : true;
        if (shouldDisplayBrackets) {
          afterPrefix += ANSI.color(openBracket, bracketColor);
          if (insideOverview) {
            if (nestedValueSpacing) {
              afterPrefix += " ";
            }
            afterPrefix += insideOverview;
            if (nestedValueSpacing) {
              afterPrefix += " ";
            }
          }
          afterPrefix += ANSI.color(closeBracket, bracketColor);
        } else {
          afterPrefix = insideOverview;
        }
        if (prefix && afterPrefix) {
          overview += " ";
        }
        overview += afterPrefix;
        diff += overview;
        break value;
      }

      // composite collapsed
      if (selfContext.collapsed) {
        const collapsedDiff = writePrefix(comparison, selfContext, {
          overview: true,
        });
        diff += collapsedDiff;
        break value;
      }

      // composite expanded
      if (node.isString && !node.isUrlString && node.canHaveLines) {
        diff += writeLinesDiff(comparison, selfContext);
        break value;
      }

      const relativeDepth = node.depth + selfContext.initialDepth;
      let indent = "  ".repeat(relativeDepth);
      let diffCount = 0;

      const writeNestedValueDiff = (nestedComparison, { resetModified }) => {
        let nestedValueDiff = writeDiff(nestedComparison, {
          ...selfContext,
          textIndent: 0,
          modified: resetModified ? false : selfContext.modified,
        });
        if (nestedComparison !== context.startComparison) {
          nestedValueDiff += `\n`;
        }
        return nestedValueDiff;
      };
      const writeGroupDiff = (
        next,
        { openBracket, closeBracket, forceBracket, valueLabel, resetModified },
      ) => {
        let groupDiff = "";
        const entryBeforeDiffArray = [];
        let skippedArray = [];
        let nestedComparison;
        const maxDiff =
          selfContext.modified || selfContext.added || selfContext.removed
            ? selfContext.maxValueInsideDiff
            : selfContext.maxDiffPerObject;
        while ((nestedComparison = next())) {
          if (nestedComparison.counters.overall.any === 0) {
            entryBeforeDiffArray.push(nestedComparison);
            continue;
          }
          diffCount++;
          // too many diff
          if (diffCount > maxDiff) {
            skippedArray.push(nestedComparison);
            continue;
          }
          // not enough space remaining
          // first write nested value (prop, value) before the diff
          const entryBeforeDiffCount = entryBeforeDiffArray.length;
          if (entryBeforeDiffCount) {
            let beforeDiff = "";
            let from =
              entryBeforeDiffCount === selfContext.maxValueBeforeDiff
                ? 0
                : Math.max(
                    entryBeforeDiffCount - selfContext.maxValueBeforeDiff + 1,
                    0,
                  );
            let to = entryBeforeDiffCount;
            let index = from;
            while (index !== to) {
              const entryBeforeDiff = entryBeforeDiffArray[index];
              beforeDiff += writeNestedValueDiff(entryBeforeDiff, {
                resetModified,
              });
              index++;
            }
            skippedArray = entryBeforeDiffArray.slice(0, from);
            entryBeforeDiffArray.length = 0;

            let skipped = skippedArray.length;
            if (skipped) {
              let aboveSummary = "";
              aboveSummary += `${skipped} ${valueLabel}s`;
              groupDiff += `${indent}  `;
              const arrowSign = diffCount > 1 ? `↕` : `↑`;
              groupDiff += ANSI.color(
                `${arrowSign} ${aboveSummary} ${arrowSign}`,
                delimitersColor,
              );
              groupDiff += "\n";
            }
            groupDiff += beforeDiff;
            skippedArray.length = 0;
          }
          groupDiff += writeNestedValueDiff(nestedComparison, {
            resetModified,
          });
        }

        skippedArray.push(...entryBeforeDiffArray);
        // now display the values after
        const skippedCount = skippedArray.length;
        if (skippedCount) {
          const maxValueAfterDiff =
            selfContext.modified || selfContext.added || selfContext.removed
              ? selfContext.maxValueInsideDiff + 1
              : selfContext.maxValueAfterDiff;
          let from = 0;
          let to =
            skippedCount === maxValueAfterDiff
              ? skippedCount
              : Math.min(maxValueAfterDiff - 1, skippedCount);
          let index = from;
          while (index !== to) {
            const nextComparison = skippedArray[index];
            if (nextComparison.counters.overall.any > 0) {
              // do not display when they come from maxDiffPerObject
              break;
            }
            index++;
            groupDiff += writeNestedValueDiff(nextComparison, {
              resetModified,
            });
          }
          skippedArray = skippedArray.slice(index);
        }
        remaining_summary: {
          if (skippedArray.length === 0) {
            break remaining_summary;
          }
          const skippedCounters = {
            total: 0,
            removed: 0,
            added: 0,
            modified: 0,
          };
          for (const skippedComparison of skippedArray) {
            skippedCounters.total++;
            if (selfContext.resultType === "actualNode") {
              if (selfContext.modified) {
                continue;
              }
              if (skippedComparison.counters.overall.any > 0) {
                selfContext.onComparisonDisplayed(skippedComparison);
                skippedCounters.modified++;
                continue;
              }
              if (skippedComparison.added) {
                selfContext.onComparisonDisplayed(skippedComparison);
                skippedCounters.added++;
                continue;
              }
              continue;
            }
            if (skippedComparison.removed) {
              selfContext.onComparisonDisplayed(skippedComparison);
              skippedCounters.removed++;
            }
          }
          let belowSummary = "";
          if (skippedCounters.total) {
            belowSummary += ANSI.color(
              skippedCounters.total === 1
                ? `1 ${valueLabel}`
                : `${skippedCounters.total} ${valueLabel}s`,
              delimitersColor,
            );
            const parts = [];
            if (skippedCounters.removed) {
              parts.push(
                ANSI.color(`${skippedCounters.removed} removed`, removedColor),
              );
            }
            if (skippedCounters.added) {
              parts.push(
                ANSI.color(`${skippedCounters.added} added`, addedColor),
              );
            }
            if (skippedCounters.modified) {
              parts.push(
                ANSI.color(
                  `${skippedCounters.modified} modified`,
                  selfContext.resultType === "actualNode"
                    ? unexpectedColor
                    : expectedColor,
                ),
              );
            }
            if (parts.length) {
              belowSummary += ` `;
              belowSummary += ANSI.color(`(`, delimitersColor);
              belowSummary += parts.join(" ");
              belowSummary += ANSI.color(`)`, delimitersColor);
            }
          }
          groupDiff += `${indent}  `;
          groupDiff += ANSI.color(`↓`, delimitersColor);
          groupDiff += " ";
          groupDiff += belowSummary;
          groupDiff += " ";
          groupDiff += ANSI.color(`↓`, delimitersColor);
          groupDiff += "\n";
        }
        if (selfContext.signs) {
          if (selfContext.resultType === "actualNode") {
            if (context.added) {
              groupDiff += ANSI.color(addedSign, addedSignColor);
              indent = indent.slice(1);
            } else if (context.modified) {
              groupDiff += ANSI.color(unexpectedSign, unexpectedSignColor);
              indent = indent.slice(1);
            }
          } else if (context.removed) {
            groupDiff += ANSI.color(removedSign, removedSignColor);
            indent = indent.slice(1);
          }
        }
        if (groupDiff) {
          if (node.isComposite) {
            groupDiff = `\n${groupDiff}`;
            groupDiff += indent;
          }
        }
        let finalGroupDiff = "";
        if (forceBracket || groupDiff.length > 0) {
          const bracketColor = getBracketColor(selfContext, comparison);
          finalGroupDiff += ANSI.color(openBracket, bracketColor);
          finalGroupDiff += groupDiff;
          finalGroupDiff += ANSI.color(closeBracket, bracketColor);
        } else {
          finalGroupDiff = groupDiff;
        }
        return finalGroupDiff;
      };

      let insideDiff = "";
      let prefix = "";
      prefix = writePrefix(comparison, selfContext);
      insideDiff += prefix;
      if (node.canHaveIndexedValues) {
        const indexedValueDiff = writeGroupDiff(
          createGetIndexedValues(comparison, selfContext),
          {
            valueLabel: "value",
            forceBracket: true,
            openBracket: "[",
            closeBracket: "]",
            resetModified:
              comparison.actualNode &&
              comparison.actualNode.canHaveIndexedValues &&
              comparison.expectedNode &&
              comparison.expectedNode.canHaveIndexedValues,
          },
        );
        if (node.isSet) {
          insideDiff += ANSI.color("(", delimitersColor);
        }
        if (indexedValueDiff) {
          insideDiff += indexedValueDiff;
        }
        if (node.isSet) {
          insideDiff += ANSI.color(")", delimitersColor);
        }
      }
      if (node.canHaveProps) {
        const propsDiff = writeGroupDiff(
          createGetProps(comparison, selfContext),
          {
            valueLabel: "prop",
            forceBracket: !node.canHaveIndexedValues && prefix.length === 0,
            openBracket: "{",
            closeBracket: "}",
            resetModified:
              comparison.actualNode &&
              comparison.actualNode.canHaveProps &&
              comparison.expectedNode &&
              comparison.expectedNode.canHaveProps,
          },
        );
        if (propsDiff) {
          if (insideDiff) {
            insideDiff += " ";
          }
          insideDiff += propsDiff;
        }
      }
      diff += insideDiff;
      break value;
    }

    if (endSeparator) {
      const endSeparatorColor = getDelimitersColor(context, comparison);
      diff += ANSI.color(endSeparator, endSeparatorColor);
    }
    return diff;
  };

  const writePrefix = (comparison, context, { overview } = {}) => {
    const node = comparison[context.resultType];
    let prefix = "";

    const internalValueNode = node.childNodes.internalValue;
    const displayInternalValueInsideConstructor =
      internalValueNode &&
      internalValueNode.inConstructor &&
      // value returned by valueOf() is not the composite itself
      !comparison.childComparisons.internalValue.hidden;
    let displaySubtype = true;
    if (overview) {
      if (node.subtype === "Object" && node.keys.length === 0) {
        displaySubtype = false;
      } else {
        displaySubtype = true;
      }
    } else if (node.subtype === "Object" || node.subtype === "Array") {
      displaySubtype = false;
    } else if (node.type === "internal_value") {
      const parentSubtype = node.parent[context.resultType].subtype;
      if (
        parentSubtype === "String" ||
        parentSubtype === "Number" ||
        parentSubtype === "Boolean"
      ) {
        displaySubtype = false;
      }
    }

    const parenthesisColor = getParenthesisColor(context, comparison);

    if (displaySubtype) {
      const subtypeColor = getSubtypeColor(context, comparison);
      prefix += ANSI.color(node.subtype, subtypeColor);
    }
    if (node.isArray) {
      if (!overview) {
        return prefix;
      }
      prefix += ANSI.color(`(`, parenthesisColor);
      const lengthColor = getConstructorArgColor(context, comparison);
      prefix += ANSI.color(node.value.length, lengthColor);
      prefix += ANSI.color(`)`, parenthesisColor);
      return prefix;
    }
    if (node.isString) {
      if (!overview) {
        return prefix;
      }
      prefix += ANSI.color(`(`, parenthesisColor);
      const lengthColor = getConstructorArgColor(context, comparison);
      prefix += ANSI.color(node.childNodes.chars.length, lengthColor);
      prefix += ANSI.color(`)`, parenthesisColor);
      return prefix;
    }
    if (node.isComposite) {
      const delimitersColor = getDelimitersColor(context, comparison);
      let insideConstructor = "";
      const prefixWithNew =
        node.subtype === "String" ||
        node.subtype === "Boolean" ||
        node.subtype === "Number";
      if (prefixWithNew) {
        prefix = `${ANSI.color(`new`, delimitersColor)} ${prefix}`;
      }

      if (displayInternalValueInsideConstructor) {
        const internalValueComparison =
          comparison.childComparisons.internalValue;
        insideConstructor = writeDiff(internalValueComparison, context);
      } else if (overview) {
        const constructorArgColor = getConstructorArgColor(context, comparison);
        if (node.isSet) {
          insideConstructor = ANSI.color(
            node.indexedValueNodes.length,
            constructorArgColor,
          );
        } else if (displaySubtype) {
          insideConstructor = ANSI.color(node.keys.length, constructorArgColor);
        } else {
          prefix += ANSI.color("{", delimitersColor);
          prefix += ANSI.color("}", delimitersColor);
        }
      }
      if (insideConstructor) {
        prefix += ANSI.color("(", parenthesisColor);
        prefix += insideConstructor;
        prefix += ANSI.color(")", parenthesisColor);
      }
      return prefix;
    }
    return prefix;
  };
  const writeOneLineDiff = (lineComparison, context) => {
    let { focusedCharIndex } = context;

    const charComparisons = lineComparison.childComparisons.chars;
    const lineNode = lineComparison[context.resultType];
    const charNodes = lineNode.childNodes.chars;
    const charBeforeArray = [];
    const charAfterArray = [];

    let remainingWidth = context.maxColumns - context.textIndent;
    let focusedCharComparison = charComparisons[focusedCharIndex];
    if (!focusedCharComparison) {
      focusedCharIndex = charNodes.length - 1;
      focusedCharComparison = charComparisons[focusedCharIndex];
    }
    const focusedCharDiff = writeDiff(focusedCharComparison, context);
    remainingWidth -= stringWidth(focusedCharDiff);

    const leftOverflowBoilerplateWidth = "…".length;
    const rightOverflowBoilerplateWidth = "…".length;
    let tryBeforeFirst = true;
    let previousCharAttempt = 0;
    let nextCharAttempt = 0;
    while (remainingWidth) {
      let charIndex;
      const previousCharIndex = focusedCharIndex - previousCharAttempt - 1;
      const nextCharIndex = focusedCharIndex + nextCharAttempt + 1;
      let hasPreviousChar = previousCharIndex >= 0;
      const hasNextChar = nextCharIndex < charNodes.length;
      if (!hasPreviousChar && !hasNextChar) {
        break;
      }
      if (!tryBeforeFirst && hasNextChar) {
        hasPreviousChar = false;
      }
      if (hasPreviousChar) {
        previousCharAttempt++;
        charIndex = previousCharIndex;
      } else if (hasNextChar) {
        nextCharAttempt++;
        charIndex = nextCharIndex;
      }
      const charNode = charNodes[charIndex];
      if (!charNode) {
        continue;
      }
      if (tryBeforeFirst && hasPreviousChar) {
        tryBeforeFirst = false;
      }
      const charDiff = writeDiff(charNode.comparison, context);
      const charWidth = stringWidth(charDiff);
      let nextWidth = charWidth;
      if (charIndex - 1 > 0) {
        nextWidth += leftOverflowBoilerplateWidth;
      }
      if (charIndex + 1 < charNodes.length - 1) {
        nextWidth += rightOverflowBoilerplateWidth;
      }
      if (nextWidth >= remainingWidth) {
        break;
      }
      if (charIndex < focusedCharIndex) {
        charBeforeArray.push(charDiff);
      } else {
        charAfterArray.push(charDiff);
      }
      remainingWidth -= charWidth;
    }

    let oneLineDiff = "";
    const delimitersColor = getDelimitersColor(context, lineComparison);
    const overflowLeft = focusedCharIndex - previousCharAttempt > 0;
    const overflowRight =
      focusedCharIndex + nextCharAttempt < charNodes.length - 1;

    const stringNode = lineNode.parent;
    const stringComparison = stringNode.comparison;

    let lineContent = "";
    lineContent += charBeforeArray.reverse().join("");
    lineContent += focusedCharDiff;
    lineContent += charAfterArray.join("");
    if (overflowLeft) {
      oneLineDiff += ANSI.color("…", delimitersColor);
    }
    if (stringComparison.quote) {
      const quoteColor = getQuoteColor(context, stringComparison);
      oneLineDiff += ANSI.color(stringComparison.quote, quoteColor);
      oneLineDiff += lineContent;
      oneLineDiff += ANSI.color(stringComparison.quote, quoteColor);
    } else {
      oneLineDiff += lineContent;
    }
    if (overflowRight) {
      oneLineDiff += ANSI.color("…", delimitersColor);
    }
    return oneLineDiff;
  };
  const writeLinesDiff = (comparison, context) => {
    const node = comparison[context.resultType];

    const lineNodes = node.childNodes.lines;
    const lineComparisons = comparison.childComparisons.lines;
    empty_string: {
      const firstLineNode = lineNodes[0];
      if (firstLineNode.value === "") {
        const quote = node.quote || DOUBLE_QUOTE;
        const bracketColor = getBracketColor(context, comparison);
        let expandedDiff = "";
        expandedDiff += ANSI.color(quote, bracketColor);
        expandedDiff += ANSI.color(quote, bracketColor);
        return expandedDiff;
      }
    }

    // collapsed
    if (context.collapsed) {
      if (!comparison.quote && node.type !== "url_part") {
        const quote =
          context.quote === "auto" ? pickBestQuote(node.value) : context.quote;
        comparison.quote = quote; // ensure the quote in expected is "forced" to the one in actual
      }

      const remainingWidth = context.maxColumns - context.textIndent;
      let maxWidth = Math.min(remainingWidth, 20);
      if (comparison.quote) {
        const quoteWidth = comparison.quote.length;
        maxWidth -= quoteWidth + quoteWidth;
      }
      let stringDiff;
      const width = stringWidth(node.value);
      if (width > maxWidth) {
        stringDiff = node.value.slice(0, maxWidth - "…".length);
        stringDiff += "…";
      } else {
        stringDiff = node.value;
      }
      const valueColor = getValueColor(context, comparison);
      let stringOverviewDiff = "";
      if (comparison.quote) {
        const quoteColor = getQuoteColor(context, comparison);
        stringOverviewDiff += ANSI.color(comparison.quote, quoteColor);
        stringOverviewDiff += ANSI.color(stringDiff, valueColor);
        stringOverviewDiff += ANSI.color(comparison.quote, quoteColor);
      } else {
        stringOverviewDiff += ANSI.color(stringDiff, valueColor);
      }
      return stringOverviewDiff;
    }

    single_line: {
      const isSingleLine = lineNodes.length === 1;
      // single line string (both actual and expected)
      if (!isSingleLine) {
        break single_line;
      }
      if (!comparison.quote && node.type !== "url_part") {
        const quote =
          context.quote === "auto" ? pickBestQuote(node.value) : context.quote;
        comparison.quote = quote; // ensure the quote in expected is "forced" to the one in actual
      }
      const firstLineComparison = lineComparisons[0];
      const focusedCharIndex = getFocusedCharIndex(firstLineComparison);
      const firstLineContext = {
        ...context,
        focusedCharIndex,
      };
      return writeOneLineDiff(firstLineComparison, firstLineContext);
    }

    multiline: {
      let focusedLineIndex = lineComparisons.findIndex((lineComparison) => {
        return lineComparison.counters.overall.any > 0;
      });
      if (focusedLineIndex === -1) {
        focusedLineIndex = lineNodes.length - 1;
      }
      const focusedLineComparison = lineComparisons[focusedLineIndex];
      const focusedCharIndex = getFocusedCharIndex(focusedLineComparison);
      let biggestLineNumber = focusedLineIndex + 1;

      const lineBeforeArray = [];
      let maxLineBefore = context.maxLineBeforeDiff - 1;
      while (maxLineBefore--) {
        const previousLineIndex = focusedLineIndex - lineBeforeArray.length - 1;
        const hasPreviousLine = previousLineIndex >= 0;
        if (!hasPreviousLine) {
          break;
        }
        const previousLineComparison = lineComparisons[previousLineIndex];
        lineBeforeArray.push(previousLineComparison);
      }
      let previousLineRemaining = focusedLineIndex - lineBeforeArray.length;
      if (previousLineRemaining === 1) {
        lineBeforeArray.push(lineNodes[0]);
        previousLineRemaining = 0;
      }

      const lineAfterArray = [];
      let maxLineAfter = context.maxLineAfterDiff - 1;
      while (maxLineAfter--) {
        const nextLineIndex = focusedLineIndex + lineAfterArray.length + 1;
        const hasNextLine = nextLineIndex < lineNodes.length;
        if (!hasNextLine) {
          break;
        }
        const nextLineComparison = lineComparisons[nextLineIndex];
        lineAfterArray.push(nextLineComparison);
        if (nextLineIndex + 1 > biggestLineNumber) {
          biggestLineNumber = nextLineIndex + 1;
        }
      }
      let nextLineRemaining =
        lineNodes.length - 1 - focusedLineIndex - lineAfterArray.length;
      if (nextLineRemaining === 1) {
        lineAfterArray.push(lineComparisons[lineComparisons.length - 1]);
        nextLineRemaining = 0;
      }

      const writeLineDiff = (lineComparison) => {
        const lineContext = {
          ...context,
          focusedCharIndex,
        };
        const delimitersColor = getDelimitersColor(lineContext, lineComparison);

        let lineDiff = "";
        const lineNumberString = String(lineComparison.index + 1);
        if (String(biggestLineNumber).length > lineNumberString.length) {
          lineDiff += " ";
        }
        lineDiff += ANSI.color(lineNumberString, delimitersColor);
        // lineDiff += " ";
        lineDiff += ANSI.color("|", delimitersColor);
        lineDiff += " ";

        lineDiff += writeOneLineDiff(lineComparison, lineContext);
        return lineDiff;
      };
      const diffLines = [];
      if (previousLineRemaining) {
        let previousLinesSkippedDiff = "";
        previousLinesSkippedDiff += " ".repeat(
          String(biggestLineNumber).length,
        );
        previousLinesSkippedDiff += ANSI.color(
          `↑ ${previousLineRemaining} lines ↑`,
          sameColor,
        );
        diffLines.push(previousLinesSkippedDiff);
      }
      for (const lineBefore of lineBeforeArray) {
        diffLines.push(writeLineDiff(lineBefore));
      }
      diffLines.push(writeLineDiff(focusedLineComparison));
      for (const lineAfter of lineAfterArray) {
        diffLines.push(writeLineDiff(lineAfter));
      }
      if (nextLineRemaining) {
        const delimitersColor = getDelimitersColor(context, comparison);
        const skippedCounters = {
          total: 0,
          modified: 0,
        };
        const from = focusedLineIndex + lineAfterArray.length + 1;
        const to = lineNodes.length;
        let index = from;
        while (index < to) {
          const nextLineComparison = lineComparisons[index];
          index++;
          skippedCounters.total++;
          if (nextLineComparison.counters.overall.any > 0) {
            context.onComparisonDisplayed(nextLineComparison);
            skippedCounters.modified++;
            continue;
          }
        }
        let nextLinesSkippedDiff = "";
        nextLinesSkippedDiff += " ".repeat(String(biggestLineNumber).length);
        nextLinesSkippedDiff += ANSI.color("↓", delimitersColor);
        nextLinesSkippedDiff += " ";
        let belowSummary = "";
        let summaryColor = "";
        if (
          comparison.actualNode.childNodes.lines.length ===
          comparison.expectedNode.childNodes.lines.length
        ) {
          summaryColor = delimitersColor;
        } else {
          summaryColor =
            context.resultType === "actualNode"
              ? unexpectedColor
              : expectedColor;
        }
        belowSummary += ANSI.color(
          `${skippedCounters.total} lines`,
          summaryColor,
        );
        const parts = [];
        if (skippedCounters.modified) {
          parts.push(
            ANSI.color(
              `${skippedCounters.modified} modified`,
              context.resultType === "actualNode"
                ? unexpectedColor
                : expectedColor,
            ),
          );
        }
        if (parts.length) {
          belowSummary += ` `;
          belowSummary += ANSI.color(`(`, delimitersColor);
          belowSummary += parts.join(" ");
          belowSummary += ANSI.color(`)`, delimitersColor);
        }
        nextLinesSkippedDiff += belowSummary;
        nextLinesSkippedDiff += " ";
        nextLinesSkippedDiff += ANSI.color("↓", delimitersColor);
        diffLines.push(nextLinesSkippedDiff);
      }
      let separator = `\n`;
      if (context.textIndent) {
        separator += " ".repeat(context.textIndent);
      }
      return diffLines.join(separator);
    }
  };
  const writeCharDiff = (comparison, context) => {
    const node = comparison[context.resultType];
    const valueColor = getValueColor(context, comparison);
    const { preserveLineBreaks } = context;
    const { quote } = comparison;
    const char = node.value;
    const point = char.charCodeAt(0);
    if (preserveLineBreaks && (char === "\n" || char === "\r")) {
      return ANSI.color(char, valueColor);
    }
    if (
      char === quote ||
      point === 92 ||
      point < 32 ||
      (point > 126 && point < 160) ||
      // line separators
      point === 8232 ||
      point === 8233
    ) {
      const replacement =
        char === quote
          ? `\\${quote}`
          : point === 8232
            ? "\\u2028"
            : point === 8233
              ? "\\u2029"
              : charMeta[point];
      return ANSI.color(replacement, valueColor);
    }
    return ANSI.color(char, valueColor);
  };
  // prettier-ignore
  const charMeta = [
    '\\x00', '\\x01', '\\x02', '\\x03', '\\x04', '\\x05', '\\x06', '\\x07', // x07
    '\\b', '\\t', '\\n', '\\x0B', '\\f', '\\r', '\\x0E', '\\x0F',           // x0F
    '\\x10', '\\x11', '\\x12', '\\x13', '\\x14', '\\x15', '\\x16', '\\x17', // x17
    '\\x18', '\\x19', '\\x1A', '\\x1B', '\\x1C', '\\x1D', '\\x1E', '\\x1F', // x1F
    '', '', '', '', '', '', '', "\\'", '', '', '', '', '', '', '', '',      // x2F
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x3F
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x4F
    '', '', '', '', '', '', '', '', '', '', '', '', '\\\\', '', '', '',     // x5F
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x6F
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '\\x7F',    // x7F
    '\\x80', '\\x81', '\\x82', '\\x83', '\\x84', '\\x85', '\\x86', '\\x87', // x87
    '\\x88', '\\x89', '\\x8A', '\\x8B', '\\x8C', '\\x8D', '\\x8E', '\\x8F', // x8F
    '\\x90', '\\x91', '\\x92', '\\x93', '\\x94', '\\x95', '\\x96', '\\x97', // x97
    '\\x98', '\\x99', '\\x9A', '\\x9B', '\\x9C', '\\x9D', '\\x9E', '\\x9F', // x9F
  ];
  // const writeUrlDiff = (comparison, context) => {
  //   const urlPartComparisons = comparison.childComparisons.urlPart;

  //   const writeUrlPart = (urlPartName) => {
  //     const urlPartComparison = urlPartComparisons[urlPartName];
  //     if (String(urlPartComparison[context.resultType]) === "") {
  //       return "";
  //     }
  //     const urlPartDiff = writeDiff(urlPartComparison, context);
  //     return urlPartDiff;
  //   };

  //   let urlDiff = "";
  //   const bracketColor = getBracketColor(context, comparison);
  //   urlDiff += ANSI.color(`"`, bracketColor);
  //   urlDiff += writeUrlPart("protocol");
  //   const usernameDiff = writeUrlPart("username");
  //   if (usernameDiff) {
  //     urlDiff += usernameDiff;
  //   }
  //   const passwordDiff = writeUrlPart("password");
  //   if (passwordDiff) {
  //     const passwordComparison = urlPartComparisons.password;
  //     const actualHasPassword = passwordComparison.actualNode.value.length;
  //     const expectedHasPassword = passwordComparison.expectedNode.value.length;
  //     let passwordSeparatorColor;
  //     if (actualHasPassword && !expectedHasPassword) {
  //       passwordSeparatorColor = addedColor;
  //     } else if (!actualHasPassword && expectedHasPassword) {
  //       passwordSeparatorColor = removedColor;
  //     } else if (passwordComparison.counters.overall.any) {
  //       passwordSeparatorColor =
  //         context.resultType === "actualNode" ? unexpectedColor : expectedColor;
  //     } else {
  //       passwordSeparatorColor = sameColor;
  //     }
  //     urlDiff += ANSI.color(":", passwordSeparatorColor);
  //     urlDiff += passwordDiff;
  //   }
  //   const hostnameDiff = writeUrlPart("hostname");
  //   if (hostnameDiff) {
  //     if (usernameDiff || passwordDiff) {
  //       const usernameComparison = urlPartComparisons.username;
  //       const passwordComparison = urlPartComparisons.password;
  //       const actualHasAuth =
  //         usernameComparison.actualNode.value.length ||
  //         passwordComparison.actualNode.value.length;
  //       const expectedHasAuth =
  //         usernameComparison.expectedNode.value.length ||
  //         passwordComparison.expectedNode.value.length;
  //       let authSeparatorColor;
  //       if (actualHasAuth && !expectedHasAuth) {
  //         authSeparatorColor = addedColor;
  //       } else if (!actualHasAuth && expectedHasAuth) {
  //         authSeparatorColor = removedColor;
  //       } else if (
  //         passwordComparison[context.resultType].length
  //           ? passwordComparison.counters.overall.any
  //           : usernameComparison.counters.overall.any
  //       ) {
  //         authSeparatorColor =
  //           context.resultType === "actualNode"
  //             ? unexpectedColor
  //             : expectedColor;
  //       } else {
  //         authSeparatorColor = sameColor;
  //       }
  //       urlDiff += ANSI.color("@", authSeparatorColor);
  //     }
  //     urlDiff += hostnameDiff;
  //   }
  //   const portDiff = writeUrlPart("port");
  //   if (portDiff) {
  //     if (hostnameDiff) {
  //       const portComparison = urlPartComparisons.port;
  //       const actualHasPort =
  //         String(portComparison.actualNode.value).length > 0;
  //       const expectedHasPort =
  //         String(portComparison.expectedNode.value).length > 0;
  //       let portSeparatorColor;
  //       if (actualHasPort && !expectedHasPort) {
  //         portSeparatorColor = addedColor;
  //       } else if (!actualHasPort && expectedHasPort) {
  //         portSeparatorColor = removedColor;
  //       } else if (portComparison.counters.overall.any) {
  //         portSeparatorColor =
  //           context.resultType === "actualNode"
  //             ? unexpectedColor
  //             : expectedColor;
  //       } else {
  //         portSeparatorColor = sameColor;
  //       }
  //       urlDiff += ANSI.color(":", portSeparatorColor);
  //     }
  //     urlDiff += portDiff;
  //   }
  //   urlDiff += writeUrlPart("pathname");
  //   const searchDiff = writeUrlPart("search");
  //   if (searchDiff) {
  //     const searchComparison = urlPartComparisons.search;
  //     const actualHasSearch = searchComparison.actualNode.value.length;
  //     const expectedHasSearch = searchComparison.expectedNode.value.length;
  //     let searchSeparatorColor;
  //     if (actualHasSearch && !expectedHasSearch) {
  //       searchSeparatorColor = addedColor;
  //     } else if (!actualHasSearch && expectedHasSearch) {
  //       searchSeparatorColor = removedColor;
  //     } else if (searchComparison.counters.overall.any) {
  //       searchSeparatorColor =
  //         context.resultType === "actualNode" ? unexpectedColor : expectedColor;
  //     } else {
  //       searchSeparatorColor = sameColor;
  //     }
  //     urlDiff += ANSI.color("?", searchSeparatorColor);
  //     urlDiff += searchDiff;
  //   }
  //   const hashDiff = writeUrlPart("hash");
  //   if (hashDiff) {
  //     const hashComparison = urlPartComparisons.hash;
  //     const actualHasHash = hashComparison.actualNode.value.length;
  //     const expectedHasHash = hashComparison.expectedNode.value.length;
  //     let hashSeparatorColor;
  //     if (actualHasHash && !expectedHasHash) {
  //       hashSeparatorColor = addedColor;
  //     } else if (!actualHasHash && expectedHasHash) {
  //       hashSeparatorColor = removedColor;
  //     } else if (hashComparison.counters.overall.any) {
  //       hashSeparatorColor =
  //         context.resultType === "actualNode" ? unexpectedColor : expectedColor;
  //     } else {
  //       hashSeparatorColor = sameColor;
  //     }
  //     urlDiff += ANSI.color("#", hashSeparatorColor);
  //     urlDiff += hashDiff;
  //   }
  //   urlDiff += ANSI.color(`"`, bracketColor);
  //   return urlDiff;
  // };
  const createGetNextNestedValue = (comparison, context) => {
    const nextIndexedValue = createGetIndexedValues(comparison, context);
    const nextProp = createGetProps(comparison, context);
    return () => {
      const indexedValue = nextIndexedValue();
      if (indexedValue) {
        return indexedValue;
      }
      return nextProp();
    };
  };
  const createGetIndexedValues = (comparison, context) => {
    const node = comparison[context.resultType];
    if (node.isSet) {
      const indexedValueComparisons = comparison.childComparisons.indexedValues;
      const indexedValueCount = indexedValueComparisons.length;
      let indexedValueIndex = 0;
      const nextSetValue = () => {
        if (indexedValueIndex < indexedValueCount) {
          const indexedValueComparison =
            indexedValueComparisons[indexedValueIndex];
          indexedValueIndex++;
          if (!indexedValueComparison[context.resultType]) {
            return nextSetValue();
          }
          return indexedValueComparison;
        }
        return null;
      };
      return nextSetValue;
    }

    const indexedValueNodes = node.childNodes.indexedValues || [];
    const indexedValueCount = indexedValueNodes.length;
    const indexedValueComparisons = comparison.childComparisons.indexedValues;
    let indexedValueIndex = 0;
    return () => {
      if (indexedValueIndex < indexedValueCount) {
        const indexedValueComparison =
          indexedValueComparisons[indexedValueIndex];
        indexedValueIndex++;
        return indexedValueComparison;
      }
      return null;
    };
  };
  const createGetProps = (comparison, context) => {
    const node = comparison[context.resultType];
    const propertyNodes = node.childNodes.properties || {};
    const propertyNames = Object.keys(propertyNodes);
    const propertyCount = propertyNames.length;
    const propertyComparisons = comparison.childComparisons.properties;
    let internalValueToDisplay = comparison.childComparisons.internalValue;
    let prototypeComparisonToDisplay = comparison.childComparisons.prototype;
    let propIndex = 0;

    return () => {
      if (internalValueToDisplay) {
        if (internalValueToDisplay[context.resultType].inConstructor) {
          internalValueToDisplay = null;
        } else if (internalValueToDisplay.hidden) {
          internalValueToDisplay = null;
        } else {
          let nestedComparison = internalValueToDisplay;
          internalValueToDisplay = null;
          return nestedComparison;
        }
      }
      if (prototypeComparisonToDisplay) {
        if (prototypeComparisonToDisplay.hidden) {
          prototypeComparisonToDisplay = null;
        } else {
          let nestedComparison = prototypeComparisonToDisplay;
          prototypeComparisonToDisplay = null;
          return nestedComparison;
        }
      }
      if (propIndex < propertyCount) {
        const propertyName = propertyNames[propIndex];
        propIndex++;
        const propertyComparison = propertyComparisons[propertyName];
        return propertyComparison;
      }
      return null;
    };
  };

  const getDelimiters = (comparison, context) => {
    const node = comparison[context.resultType];
    if (node.isArray) {
      return {
        openBracket: "[",
        closeBracket: "]",
        nestedValueSeparator: ",",
        ellipsis: "...",
      };
    }
    if (node.isComposite) {
      return {
        openBracket: "{",
        closeBracket: "}",
        nestedValueSeparator: ",",
        nestedValueSpacing: true,
        ellipsis: "...",
      };
    }
    if (node.canHaveLines) {
      return {
        openBracket: `${node.index + 1} | `,
        closeBracket: "",
      };
    }
    if (node.canHaveChars) {
      return {
        nestedValueSeparator: "",
        ellipsis: "...",
      };
    }
    return null;
  };

  const getColorFor = (forWhat, context, comparison) => {
    if (context.removed) {
      return removedColor;
    }
    if (context.added) {
      return addedColor;
    }
    if (context.modified) {
      const { actualNode, expectedNode } = comparison;
      if (!actualNode || !expectedNode) {
        return context.resultType === "actualNode"
          ? unexpectedColor
          : expectedColor;
      }
      // ideally we should loop until we find the least nested internal value
      // but I'm not sure it's a good idea (the diff output would feel messy)
      let actualTarget = actualNode;
      let expectedTarget = expectedNode;
      let internalValueModified = true;
      if (forWhat !== "subtype" && forWhat !== "parenthesis") {
        const actualInternalValueNode =
          actualNode.type === "internal_value"
            ? actualNode
            : actualNode.childNodes.internalValue;
        const expectedInternalValueNode =
          expectedNode.type === "internal_value"
            ? expectedNode
            : expectedNode.childNodes.internalValue;
        if (actualInternalValueNode && expectedInternalValueNode) {
          actualTarget = actualInternalValueNode;
          expectedTarget = expectedInternalValueNode;
          if (
            actualTarget.comparison.counters.overall.any === 0 &&
            expectedTarget.comparison.counters.overall.any === 0
          ) {
            internalValueModified = false;
            return sameColor;
          }
        } else if (actualInternalValueNode) {
          actualTarget = actualInternalValueNode;
          if (actualTarget.comparison.counters.overall.any === 0) {
            internalValueModified = false;
          }
        } else if (expectedInternalValueNode) {
          expectedTarget = expectedInternalValueNode;
          if (expectedTarget.comparison.counters.overall.any === 0) {
            internalValueModified = false;
          }
        }
      }

      if (forWhat === "subtype") {
        if (
          actualTarget.isComposite &&
          expectedTarget.isComposite &&
          actualTarget.subtype === expectedTarget.subtype
        ) {
          return sameColor;
        }
        if (
          actualTarget.isComposite === expectedTarget.isComposite &&
          actualTarget.canHaveLines &&
          expectedTarget.canHaveLines
        ) {
          return sameColor;
        }
      }
      if (forWhat === "parenthesis") {
        if (actualTarget.isComposite === expectedTarget.isComposite) {
          return sameColor;
        }
      }
      if (forWhat === "constructor_arg") {
        if (
          actualTarget.isArray &&
          expectedTarget.isArray &&
          actualTarget.value.length === expectedTarget.value.length
        ) {
          return sameColor;
        }
        if (
          actualTarget.isString &&
          expectedTarget.isString &&
          actualTarget.childNodes.chars.length ===
            expectedTarget.childNodes.chars.length
        ) {
          return sameColor;
        }
        if (actualTarget.isSet && expectedTarget.isSet) {
          if (context.resultType === "actualNode") {
            for (const actualValue of actualTarget.value) {
              if (!expectedTarget.value.has(actualValue)) {
                return addedColor;
              }
            }
            return sameColor;
          }
          for (const expectedValue of expectedTarget.value) {
            if (!expectedTarget.value.has(expectedValue)) {
              return removedColor;
            }
          }
          return sameColor;
        }
        if (
          actualTarget.isSet === expectedTarget.isSet &&
          actualTarget.isComposite &&
          expectedTarget.isComposite &&
          actualTarget.keys.length === expectedTarget.keys.length
        ) {
          return sameColor;
        }
      }
      if (forWhat === "bracket") {
        if (actualTarget.isComposite && expectedTarget.isComposite) {
          const actualOpenBracket =
            actualTarget.isArray || actualTarget.isSet ? "[" : "{";
          const expectedOpenBracket =
            expectedTarget.isArray || expectedTarget.isSet ? "[" : "{";
          if (actualOpenBracket === expectedOpenBracket) {
            // they use same brackets
            return sameColor;
          }
        }
        if (actualTarget.isString && expectedTarget.isString) {
          // they use same brackets
          return sameColor;
        }
      }
      if (forWhat === "quote") {
        if (
          // for sets actualNode/expectedNode is null
          // and as long as the comparison is not added/removed
          // it means the value is found in the other set
          comparison.type === "indexed_value" &&
          comparison.parent.combinations.sets
        ) {
          return sameColor;
        }
        if (actualTarget.isComposite === expectedTarget.isComposite) {
          return sameColor;
        }
      }
      if (!internalValueModified) {
        return sameColor;
      }
      return context.resultType === "actualNode"
        ? unexpectedColor
        : expectedColor;
    }
    return sameColor;
  };
  const getSubtypeColor = (context, comparison) => {
    return getColorFor("subtype", context, comparison);
  };
  const getConstructorArgColor = (context, comparison) => {
    return getColorFor("constructor_arg", context, comparison);
  };
  const getBracketColor = (context, comparison) => {
    return getColorFor("bracket", context, comparison);
  };
  const getParenthesisColor = (context, comparison) => {
    return getColorFor("parenthesis", context, comparison);
  };
  const getDelimitersColor = (context, comparison) => {
    return getColorFor("delimiters", context, comparison);
  };
  const getQuoteColor = (context, comparison) => {
    return getColorFor("quote", context, comparison);
  };
  const getValueColor = (context, comparison) => {
    return getColorFor("value", context, comparison);
  };

  const DOUBLE_QUOTE = `"`;
  const SINGLE_QUOTE = `'`;
  const BACKTICK = "`";
  const pickBestQuote = (
    string,
    { canUseTemplateString, quoteDefault = DOUBLE_QUOTE } = {},
  ) => {
    const containsDoubleQuote = string.includes(DOUBLE_QUOTE);
    if (!containsDoubleQuote) {
      return DOUBLE_QUOTE;
    }
    const containsSimpleQuote = string.includes(SINGLE_QUOTE);
    if (!containsSimpleQuote) {
      return SINGLE_QUOTE;
    }
    if (canUseTemplateString) {
      const containsBackTick = string.includes(BACKTICK);
      if (!containsBackTick) {
        return BACKTICK;
      }
    }
    const doubleQuoteCount = string.split(DOUBLE_QUOTE).length - 1;
    const singleQuoteCount = string.split(SINGLE_QUOTE).length - 1;
    if (singleQuoteCount > doubleQuoteCount) {
      return DOUBLE_QUOTE;
    }
    if (doubleQuoteCount > singleQuoteCount) {
      return SINGLE_QUOTE;
    }
    return quoteDefault;
  };
}

const isComposite = (value) => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};
const humanizePropertyKey = (property) => {
  if (typeof property === "symbol") {
    return humanizeSymbol(property);
  }
  if (typeof property === "string") {
    return humanizePropertyName(property);
  }
  return property;
};
const humanizePropertyName = (propertyName) => {
  if (isDotNotationAllowed(propertyName)) {
    return propertyName;
  }
  return `"${propertyName}"`; // TODO: proper quote escaping
};
const humanizeSymbol = (symbol) => {
  const symbolWellKnownId = getWellKnownId(symbol);
  if (symbolWellKnownId) {
    return symbolWellKnownId;
  }
  const description = symbolToDescription(symbol);
  if (description) {
    const key = Symbol.keyFor(symbol);
    if (key) {
      return `Symbol.for(${description})`;
    }
    return `Symbol(${description})`;
  }
  return `Symbol()`;
};
const isDotNotationAllowed = (propertyName) => {
  return (
    /^[a-z_$]+[0-9a-z_&]$/i.test(propertyName) ||
    /^[a-z_$]$/i.test(propertyName)
  );
};
const symbolToDescription = (symbol) => {
  const toStringResult = symbol.toString();
  const openingParenthesisIndex = toStringResult.indexOf("(");
  const closingParenthesisIndex = toStringResult.indexOf(")");
  return toStringResult.slice(
    openingParenthesisIndex + 1,
    closingParenthesisIndex,
  );
  // return symbol.description // does not work on node
};
const createValuePath = (path = "") => {
  return {
    toString: () => path,
    valueOf: () => path,
    append: (property, { isPropertyDescriptor } = {}) => {
      let propertyKey = "";
      let propertyKeyCanUseDot = false;
      if (typeof property === "symbol") {
        propertyKey = humanizeSymbol(property);
      } else if (typeof property === "string") {
        if (isDotNotationAllowed(property)) {
          propertyKey = property;
          propertyKeyCanUseDot = true;
        } else {
          propertyKey = `"${property}"`;
        }
      } else {
        propertyKey = String(property);
        propertyKeyCanUseDot = true;
      }
      let propertyPathString;
      if (path) {
        if (isPropertyDescriptor) {
          propertyPathString += `${path}[[${propertyKey}]]`;
        } else if (propertyKeyCanUseDot) {
          propertyPathString = `${path}.${propertyKey}`;
        } else {
          propertyPathString += `${path}[${propertyKey}]`;
        }
      } else {
        propertyPathString = propertyKey;
      }
      return createValuePath(propertyPathString);
    },
  };
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
let getWellKnownId;
{
  const wellKnownWeakMap = new WeakMap();
  const symbolWellKnownMap = new Map();
  getWellKnownId = (value) => {
    if (!wellKnownWeakMap.size) {
      addWellKnownComposite(global);
    }
    if (typeof value === "symbol") {
      return symbolWellKnownMap.get(value);
    }
    return wellKnownWeakMap.get(value);
  };
  const addWellKnownComposite = (value) => {
    const visitValue = (value, valuePath) => {
      if (typeof value === "symbol") {
        symbolWellKnownMap.set(value, String(valuePath));
        return;
      }
      if (!isComposite(value)) {
        return;
      }

      if (wellKnownWeakMap.has(value)) {
        // prevent infinite recursion on circular structures
        return;
      }
      wellKnownWeakMap.set(value, String(valuePath));

      const visitProperty = (property) => {
        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, property);
        } catch (e) {
          // may happen if you try to access some iframe properties or stuff like that
          if (e.name === "SecurityError") {
            return;
          }
          throw e;
        }
        if (!descriptor) {
          return;
        }
        // do not trigger getter/setter
        if ("value" in descriptor) {
          const propertyValue = descriptor.value;
          visitValue(propertyValue, valuePath.append(property));
        }
      };
      for (const property of Object.getOwnPropertyNames(value)) {
        visitProperty(property);
      }
      for (const symbol of Object.getOwnPropertySymbols(value)) {
        visitProperty(symbol);
      }
    };
    visitValue(value, createValuePath());
  };
}

const splitChars = (string) => {
  // eslint-disable-next-line new-cap
  const splitter = new Graphemer.default();
  return splitter.splitGraphemes(string);
};

const getFocusedCharIndex = (
  comparison,
  // context
) => {
  const charWithDiffIndex = comparison.childComparisons.chars.findIndex(
    (charComparison) => {
      return charComparison.counters.overall.any > 0;
    },
  );
  if (charWithDiffIndex !== -1) {
    return charWithDiffIndex;
  }
  return -1;
  // const charNodes = comparison[context.resultType].charNodes;
  // return charNodes.length - 1;
};

const canParseUrl =
  URL.canParse ||
  (() => {
    try {
      // eslint-disable-next-line no-new, no-undef
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  });
