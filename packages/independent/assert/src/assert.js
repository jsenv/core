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
      if (comparison.type === "property") {
        // descriptors will do that
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
      comparison.done = true;
    };
    const appendCounters = (counter, otherCounter) => {
      counter.any += otherCounter.any;
      counter.removed += otherCounter.removed;
      counter.added += otherCounter.added;
      counter.modified += otherCounter.modified;
    };

    const compare = (comparison, options = {}) => {
      const { actualNode, expectedNode } = comparison;

      let ownerComparison;
      if (
        comparison.type === "property_descriptor" ||
        comparison.type === "property" ||
        comparison.type === "prototype"
      ) {
        ownerComparison =
          comparison.type === "prototype" || comparison.type === "property"
            ? comparison.parent
            : comparison.parent.parent;
        const ownerActualNode = ownerComparison.actualNode;
        const ownnerExpectedNode = ownerComparison.expectedNode;
        if (!actualNode) {
          if (ownerActualNode && ownerActualNode.canHaveProps) {
            comparison.removed = true;
          }
        } else if (!expectedNode) {
          if (ownnerExpectedNode && ownnerExpectedNode.canHaveProps) {
            comparison.added = true;
          }
        }
      } else if (comparison.type === "indexed_value") {
        ownerComparison = comparison.parent;
        const ownerActualNode = ownerComparison.actualNode;
        const ownnerExpectedNode = ownerComparison.expectedNode;
        if (ownerComparison.combinations.sets) {
          if (actualNode) {
            const added = ownnerExpectedNode.value.has(actualNode.value);
            if (added) {
              comparison.added = true;
            }
          } else {
            const removed = !ownerActualNode.value.has(expectedNode.value);
            if (removed) {
              comparison.removed = true;
            }
          }
        } else if (!actualNode) {
          if (ownerActualNode && ownerActualNode.canHaveIndexedValues) {
            comparison.removed = true;
          }
        } else if (!expectedNode) {
          if (ownnerExpectedNode && ownnerExpectedNode.canHaveIndexedValues) {
            comparison.added = true;
          }
        }
      } else if (comparison.type === "char") {
        ownerComparison = comparison.parent.parent;
        const ownerActualNode = ownerComparison.actualNode;
        const ownnerExpectedNode = ownerComparison.expectedNode;
        if (!actualNode) {
          if (ownerActualNode && ownerActualNode.canHaveLines) {
            comparison.removed = true;
          }
        } else if (!expectedNode) {
          if (ownnerExpectedNode && ownnerExpectedNode.canHaveLines) {
            comparison.added = true;
          }
        }
      }
      if (!comparison.hidden) {
        if (comparison.removed) {
          comparison.counters.self.removed++;
          addCause(comparison);
        } else if (comparison.added) {
          comparison.counters.self.added++;
          addCause(comparison);
        }
      }

      const compareInside = (insideComparison, insideOptions = {}) => {
        const insideActualNode = insideComparison.actualNode;
        const insideExpectedNode = insideComparison.expectedNode;
        if (!insideActualNode) {
          if (insideExpectedNode.showOnlyWhenModified) {
            insideComparison.hidden = true;
          }
        } else if (!insideExpectedNode) {
          if (insideActualNode.showOnlyWhenModified) {
            insideComparison.hidden = true;
          }
        }

        compare(insideComparison, { ...options, ...insideOptions });
        if (insideComparison.counters.overall.any) {
          appendCounters(
            comparison.counters.inside,
            insideComparison.counters.overall,
          );
        } else if (insideActualNode && insideExpectedNode) {
          const actualShouldHideBecauseNoDiff =
            insideActualNode.showOnlyWhenModified ||
            insideActualNode.showOnlyWhenDiff;
          const expectedShouldHideBecauseNoDiff =
            insideExpectedNode.showOnlyWhenModified ||
            insideExpectedNode.showOnlyWhenDiff;
          if (
            actualShouldHideBecauseNoDiff &&
            expectedShouldHideBecauseNoDiff
          ) {
            insideComparison.hidden = true;
          }
        }
      };

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
          propertyDescriptorComparisons[descriptorName] =
            propertyDescriptorComparison;
          compareInside(propertyDescriptorComparison);
        };
        visitPropertyDescriptor("value");
        visitPropertyDescriptor("enumerable");
        visitPropertyDescriptor("writable");
        visitPropertyDescriptor("configurable");
        visitPropertyDescriptor("set");
        visitPropertyDescriptor("get");
        settleCounters(comparison);
        return;
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

      let ignoreReferenceDiff = !actualNode || !expectedNode;
      let ignoreCategoryDiff = !actualNode || !expectedNode;
      let ignorePrototypeDiff = !actualNode || !expectedNode;
      let ignoreInternalValueDiff = false;
      let ignorePropertiesDiff =
        // prevent to compare twice when internal can have
        // but wrapper cannot
        actualNode &&
        !actualNode.canHaveProps &&
        expectedNode &&
        !expectedNode.canHaveProps;
      let ignoreIndexedValuesDiff =
        actualNode &&
        !actualNode.canHaveIndexedValues &&
        expectedNode &&
        !expectedNode.canHaveIndexedValues;
      let ignoreLinesDiff =
        actualNode &&
        !actualNode.canHaveLines &&
        expectedNode &&
        !expectedNode.canHaveLines;
      let ignoreCharsDiff =
        actualNode &&
        !actualNode.canHaveChars &&
        expectedNode &&
        !expectedNode.canHaveChars;
      let ignoreUrlPartsDiff =
        actualNode &&
        !actualNode.canHaveUrlParts &&
        expectedNode &&
        !expectedNode.canHaveUrlParts;

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

      const actualInternalValueNode = actualNode
        ? actualNode.childNodes.internalValue
        : null;
      const expectedInternalValueNode = expectedNode
        ? expectedNode.childNodes.internalValue
        : null;
      const actualInternalOrSelfNode = actualInternalValueNode || actualNode;
      const expectedInternalOrSelfNode =
        expectedInternalValueNode || expectedNode;
      internal_value: {
        if (ignoreInternalValueDiff) {
          break internal_value;
        }
        if (!actualInternalValueNode && !expectedInternalValueNode) {
          break internal_value;
        }
        const internalValueComparison = createComparison(
          actualInternalOrSelfNode,
          expectedInternalOrSelfNode,
        );
        comparison.childComparisons.internalValue = internalValueComparison;
        compareInside(internalValueComparison);
      }
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
      }

      inside: {
        string: {
          lines: {
            if (ignoreLinesDiff) {
              break lines;
            }
            const actualLineNodes =
              getSelfOrInternalNodes(actualNode, "lines") || [];
            const expectedLineNodes =
              getSelfOrInternalNodes(expectedNode, "lines") || [];
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
            if (ignoreCharsDiff) {
              break chars;
            }
            const actualCharNodes =
              getSelfOrInternalNodes(actualNode, "chars") || [];
            const expectedCharNodes =
              getSelfOrInternalNodes(expectedNode, "chars") || [];
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
          if (ignoreUrlPartsDiff) {
            break url_parts;
          }
          const actualUrlPartNodes =
            getSelfOrInternalNodes(actualNode, "urlParts") || {};
          const expectedUrlPartNodes =
            getSelfOrInternalNodes(expectedNode, "urlParts") || {};
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
          for (const expectedUrlPartName of Object.keys(expectedUrlPartNodes)) {
            if (!urlPartComparisons[expectedUrlPartName]) {
              visitUrlPart(expectedUrlPartName);
            }
          }
        }
        indexed_values: {
          if (ignoreIndexedValuesDiff) {
            break indexed_values;
          }
          const actualIndexedValueNodes =
            getSelfOrInternalNodes(actualNode, "indexedValues") || [];
          const expectedIndexedValueNodes =
            getSelfOrInternalNodes(expectedNode, "indexedValues") || [];
          const indexedValueComparisons =
            comparison.childComparisons.indexedValues;
          if (
            actualIndexedValueNodes.length === 0 &&
            expectedIndexedValueNodes.length === 0
          ) {
            break indexed_values;
          }

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
          if (ignorePropertiesDiff) {
            break properties;
          }
          const actualPropertyNodes =
            getSelfOrInternalNodes(actualNode, "properties") || {};
          const expectedPropertyNodes =
            getSelfOrInternalNodes(expectedNode, "properties") || {};
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

      settleCounters(comparison);
    };
    const createComparison = (actualNode, expectedNode) => {
      let mainNode;
      let fromInternalValue = false;
      if (actualNode && actualNode.type === "internal_value") {
        mainNode = actualNode;
        fromInternalValue = true;
      } else if (expectedNode && expectedNode.type === "internal_value") {
        mainNode = expectedNode;
        fromInternalValue = true;
      } else {
        mainNode = actualNode || expectedNode;
      }

      // if (actualNode && actualNode.comparison) {
      //   throw new Error("nope");
      // } else if (expectedNode && expectedNode.comparison) {
      //   throw new Error("nope");
      // }

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
        hidden:
          actualNode && expectedNode
            ? actualNode.hidden && expectedNode.hidden
            : actualNode
              ? actualNode.hidden
              : expectedNode.hidden,
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
    const _createValueNode = ({
      parent,
      path,
      type,
      value,
      origin,
      showOnlyWhenModified = false,
      showOnlyWhenDiff = false,
    }) => {
      const node = {
        name,
        id: nodeId++,
        path,
      };

      info: {
        let composite = false;
        let primitive = false;
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
          primitive = !composite;
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
        const canHaveProps = composite;
        const canHaveLines =
          (isString || isStringObject) && type !== "line" && type !== "char";
        // const canHaveChars = isString && type !== "char";
        const canHaveChars =
          // isString is important because value can be undefined, for example when:
          // - actual is not a string and expected is
          // - actual string is shorter
          // - ...
          isString && type === "line";
        const canHaveUrlParts = isUrlString || isUrl;

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
          isPrimitive: primitive,
          isString,
          isArray,
          isSet,
          isUrl,
          isUrlString,
          canHaveProps,
          canHaveIndexedValues,
          canHaveLines,
          canHaveChars,
          canHaveUrlParts,
          wellKnownId,
          inConstructor,
          hidden: false,
          showOnlyWhenModified,
          showOnlyWhenDiff,
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
          showOnlyWhenModified: true,
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
        if (internalValue === node.value) {
          internalValueNode.hidden = true;
        }
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
            showOnlyWhenDiff: !propertyDescriptor.enumerable,
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
              showOnlyWhenModified: isDefaultDescriptor(
                propertyDescriptorName,
                propertyDescriptorValue,
              ),
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
    const node = comparison[context.resultType];
    if (node.hidden) {
      return "";
    }
    if (
      comparison.type === "internal_value" &&
      node.type !== "internal_value"
    ) {
      return "";
    }
    context.onComparisonDisplayed(comparison);
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
    let displaySubtype = true;
    let displayValue = true;
    let endSeparator = "";
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
      if (context.collapsedWithOverview) {
        selfContext.collapsedWithOverview = false;
        selfContext.collapsed = true;
      } else if (context.collapsed) {
      } else {
        const isMultiline =
          node.canHaveLines && node.childNodes.lines.length > 1;
        if (
          comparison !== selfContext.startComparison &&
          // when using
          // foo: 1| line 1
          //      2| line 2
          //      3| line 3
          // the "," separator is removed because it's not correctly separated from the multiline
          // and it becomes hard to know if "," is part of the string or not
          !isMultiline
        ) {
          endSeparator = ",";
        }

        const relativeDepth = node.depth + selfContext.initialDepth;
        if (relativeDepth >= selfContext.maxDepth) {
          selfContext.collapsedWithOverview = true;
        } else if (comparison.counters.overall.any === 0) {
          selfContext.collapsedWithOverview = true;
        }
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
        const propertyKeyFormatted = humanizePropertyKey(property);
        diff += ANSI.color(propertyKeyFormatted, keyColor);
        if (
          node.type === "property_descriptor" &&
          node.descriptor !== "value"
        ) {
          diff += ANSI.color("[[", keyColor);
          diff += ANSI.color(node.descriptor, keyColor);
          diff += ANSI.color("]]", keyColor);
        }
        if (displayValue) {
          diff += ANSI.color(":", keyColor);
          diff += " ";
        }
      }
    }

    selfContext.textIndent += stringWidth(diff);
    selfContext.maxColumns -= endSeparator.length;
    if (selfContext.modified || selfContext.added || selfContext.removed) {
      selfContext.maxDepth = Math.min(
        node.depth + selfContext.maxDepthInsideDiff,
        selfContext.maxDepth,
      );
    }

    reference: {
      // referencing an other composite
      if (node.reference) {
        diff += ANSI.color(
          `<ref #${selfContext.getDisplayedId(node.reference.id)}>`,
          delimitersColor,
        );
        displayValue = false;
        displaySubtype = false;
        break reference;
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

    let subtypeDiff = "";
    if (displaySubtype && node.isComposite) {
      subtypeDiff = writeSubtypeDiff(comparison, selfContext, context);
    }

    let valueDiff = "";
    value: {
      if (!displayValue) {
        break value;
      }
      if (node.wellKnownId) {
        const valueColor = getValueColor(selfContext, comparison);
        valueDiff += ANSI.color(node.wellKnownId, valueColor);
        break value;
      }
      if (
        selfContext.collapsedWithOverview &&
        node.type === "property_descriptor" &&
        (node.descriptor === "get" || node.descriptor === "set")
      ) {
        const propertyDescriptorNodes =
          node.parent.childNodes.propertyDescriptors;
        const getterNode = propertyDescriptorNodes.get;
        const setterNode = propertyDescriptorNodes.set;
        const hasGetter = getterNode && getterNode.value;
        const hasSetter = setterNode && setterNode.value;
        const valueColor = getValueColor(selfContext, comparison);
        if (hasGetter && hasSetter) {
          valueDiff += ANSI.color("[get/set]", valueColor);
          break value;
        }
        if (hasGetter) {
          valueDiff += ANSI.color("[get]", valueColor);
          break value;
        }
        valueDiff += ANSI.color("[set]", valueColor);
        break value;
      }
      if (node.isPrimitive && !node.isUrlString) {
        if (node.canHaveLines) {
          valueDiff += writeLinesDiff(comparison, selfContext);
          break value;
        }
        if (node.isString) {
          valueDiff += writeCharDiff(comparison, selfContext);
          break value;
        }

        const value = node.value;
        let valueDiffRaw =
          value === undefined
            ? "undefined"
            : value === null
              ? "null"
              : JSON.stringify(value);
        if (
          valueDiffRaw.length >
          selfContext.maxColumns - selfContext.textIndent
        ) {
          valueDiffRaw = valueDiffRaw.slice(
            0,
            selfContext.maxColumns - selfContext.textIndent - "…".length,
          );
          valueDiffRaw += "…";
        }
        const valueColor = getValueColor(selfContext, comparison);
        valueDiff += ANSI.color(valueDiffRaw, valueColor);
        break value;
      }
      if (node.isString && !node.isUrlString && node.canHaveLines) {
        valueDiff += writeLinesDiff(comparison, selfContext);
        break value;
      }
      if (selfContext.collapsed) {
        break value;
      }
      if (node.type === "property") {
        const propertyDescriptorComparisons =
          comparison.childComparisons.propertyDescriptors;
        if (selfContext.collapsedWithOverview) {
          const propertyGetterComparison = propertyDescriptorComparisons.get;
          const propertySetterComparison = propertyDescriptorComparisons.set;
          const propertyGetterNode = propertyGetterComparison
            ? propertyGetterComparison[selfContext.resultType]
            : null;
          const propertySetterNode = propertySetterComparison
            ? propertySetterComparison[selfContext.resultType]
            : null;
          if (propertyGetterNode && propertySetterNode) {
            valueDiff += writeDiff(propertyGetterComparison, selfContext);
            break value;
          }
          if (propertyGetterNode) {
            valueDiff += writeDiff(propertyGetterComparison, selfContext);
            break value;
          }
          if (propertySetterNode) {
            valueDiff += writeDiff(propertySetterComparison, selfContext);
            break value;
          }
          const propertyValueComparison = propertyDescriptorComparisons.value;
          valueDiff += writeDiff(propertyValueComparison, selfContext);
          break value;
        }
        let propertyDiff = "";
        const propertyDescriptorNames = Object.keys(
          propertyDescriptorComparisons,
        );
        for (const propertyDescriptorName of propertyDescriptorNames) {
          const propertyDescriptorComparison =
            propertyDescriptorComparisons[propertyDescriptorName];
          if (propertyDescriptorComparison) {
            let propertyDescriptorDiff = writeDiff(
              propertyDescriptorComparison,
              selfContext,
            );
            if (propertyDescriptorDiff) {
              if (propertyDiff) {
                propertyDiff += "\n";
                selfContext.textIndent = 0;
              }
              propertyDiff += propertyDescriptorDiff;
            }
          }
        }
        valueDiff += propertyDiff;
        break value;
      }

      if (selfContext.collapsedWithOverview) {
        const bracketColor = getBracketColor(selfContext, comparison);
        const valueColor = getValueColor(selfContext, comparison);
        const {
          openBracket,
          closeBracket,
          nestedValueSeparator,
          nestedValueSpacing,
          ellipsis,
        } = getDelimiters(comparison, selfContext);

        const subtypeDiffCollapsed = writeSubtypeDiff(
          comparison,
          { ...selfContext, collapsedWithOverview: false, collapsed: true },
          context,
        );
        const estimatedCollapsedBoilerplate = `${subtypeDiffCollapsed} ${openBracket}${nestedValueSeparator} ${ellipsis}${closeBracket}`;
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
          if (nestedComparison.hidden) {
            continue;
          }
          let valueDiffOverview = "";
          valueDiffOverview += writeDiff(nestedComparison, selfContext);
          const valueWidth = stringWidth(valueDiffOverview);
          if (width + valueWidth > remainingWidth) {
            let overviewTruncated = "";
            overviewTruncated += subtypeDiffCollapsed;
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
            valueDiff += overviewTruncated;
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
          insideOverview += valueDiffOverview;
          width += valueWidth;
        }
        const shouldDisplayBrackets = subtypeDiff
          ? insideOverview.length > 0
          : true;
        if (shouldDisplayBrackets) {
          valueDiff += ANSI.color(openBracket, bracketColor);
          if (insideOverview) {
            if (nestedValueSpacing) {
              valueDiff += " ";
            }
            valueDiff += insideOverview;
            if (nestedValueSpacing) {
              valueDiff += " ";
            }
          }
          valueDiff += ANSI.color(closeBracket, bracketColor);
        } else {
          valueDiff += insideOverview;
        }
        break value;
      }

      // composite
      const relativeDepth = node.depth + selfContext.initialDepth;
      let indent = "  ".repeat(relativeDepth);
      let diffCount = 0;

      const writeNestedValueDiff = (nestedComparison, { resetModified }) => {
        let nestedValueDiff = writeDiff(nestedComparison, {
          ...selfContext,
          textIndent: 0,
          modified: resetModified ? false : selfContext.modified,
        });
        if (nestedValueDiff && nestedComparison !== context.startComparison) {
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
          if (nestedComparison.hidden) {
            continue;
          }
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
      const actualInternalOrSelfNode = comparison.actualNode
        ? comparison.actualNode.childNodes.internalValue ||
          comparison.actualNode
        : null;
      const expectedInternalOrSelfNode = comparison.expectedNode
        ? comparison.expectedNode.childNodes.internalValue ||
          comparison.expectedNode
        : null;

      if (node.canHaveIndexedValues) {
        const indexedValueDiff = writeGroupDiff(
          createGetIndexedValues(comparison, selfContext),
          {
            valueLabel: "value",
            forceBracket: true,
            openBracket: "[",
            closeBracket: "]",
            resetModified:
              actualInternalOrSelfNode &&
              actualInternalOrSelfNode.canHaveIndexedValues &&
              expectedInternalOrSelfNode &&
              expectedInternalOrSelfNode.canHaveIndexedValues,
          },
        );
        if (node.isSet) {
          insideDiff += ANSI.color("(", delimitersColor);
          insideDiff += indexedValueDiff;
          insideDiff += ANSI.color(")", delimitersColor);
        } else {
          insideDiff += indexedValueDiff;
        }
      }
      if (node.canHaveProps) {
        const propsDiff = writeGroupDiff(
          createGetProps(comparison, selfContext),
          {
            valueLabel: "prop",
            forceBracket:
              !node.canHaveIndexedValues && subtypeDiff.length === 0,
            openBracket: "{",
            closeBracket: "}",
            resetModified:
              actualInternalOrSelfNode &&
              actualInternalOrSelfNode.canHaveProps &&
              expectedInternalOrSelfNode &&
              expectedInternalOrSelfNode.canHaveProps,
          },
        );
        if (propsDiff) {
          if (insideDiff) {
            insideDiff += " ";
          }
          insideDiff += propsDiff;
        }
      }
      valueDiff += insideDiff;
      break value;
    }

    diff += subtypeDiff;
    if (subtypeDiff && valueDiff) {
      diff += " ";
    }
    diff += valueDiff;
    if (endSeparator) {
      const endSeparatorColor = getDelimitersColor(context, comparison);
      diff += ANSI.color(endSeparator, endSeparatorColor);
    }
    return diff;
  };

  const writeSubtypeDiff = (comparison, selfContext, context) => {
    let subtypeDiff = "";
    const node = comparison[context.resultType];
    const useNew =
      node.subtype === "String" ||
      node.subtype === "Boolean" ||
      node.subtype === "Number";
    if (useNew) {
      const constructorNewColor = getConstructorNewColor(
        selfContext,
        comparison,
      );
      subtypeDiff += ANSI.color(`new`, constructorNewColor);
      subtypeDiff += " ";
    }
    if (
      selfContext.collapsed ||
      (node.subtype !== "Object" && node.subtype !== "Array")
    ) {
      const subtypeColor = getSubtypeColor(selfContext, comparison);
      subtypeDiff += ANSI.color(node.subtype, subtypeColor);
    }

    let insideConstructor = "";
    if (node.isArray) {
      if (selfContext.collapsed) {
        const lengthColor = getConstructorArgColor(selfContext, comparison);
        insideConstructor += ANSI.color(node.value.length, lengthColor);
      }
    } else if (node.isString) {
      if (selfContext.collapsed) {
        const lengthColor = getConstructorArgColor(selfContext, comparison);
        insideConstructor += ANSI.color(node.value.length, lengthColor);
      }
    } else if (node.isSet) {
      if (selfContext.collapsed) {
        const sizeColor = getConstructorArgColor(selfContext, comparison);
        insideConstructor = ANSI.color(
          node.indexedValueNodes.length,
          sizeColor,
        );
      }
    } else {
      const internalValueNode = node.childNodes.internalValue;
      const displayInternalValueInsideConstructor =
        internalValueNode &&
        internalValueNode.inConstructor &&
        // value returned by valueOf() is not the composite itself
        !internalValueNode.hidden;
      if (displayInternalValueInsideConstructor) {
        const internalValueComparison =
          comparison.childComparisons.internalValue;
        insideConstructor += writeDiff(internalValueComparison, context);
      } else if (node.canHaveProps) {
        if (selfContext.collapsed) {
          const keysLengthColor = getConstructorArgColor(context, comparison);
          insideConstructor = ANSI.color(node.keys.length, keysLengthColor);
        }
      }
    }

    if (insideConstructor) {
      const constructorParenthesisColor = getConstructorParenthesisColor(
        selfContext,
        comparison,
      );
      subtypeDiff += ANSI.color(`(`, constructorParenthesisColor);
      subtypeDiff += insideConstructor;
      subtypeDiff += ANSI.color(`)`, constructorParenthesisColor);
    }
    return subtypeDiff;
  };

  const writeOneLineDiff = (
    lineComparison,
    context,
    { focusedCharIndex, resetModified },
  ) => {
    const lineContext = {
      ...context,
      modified: resetModified ? false : context.modified,
    };
    const writeOneCharDiff = (charComparison) => {
      return writeDiff(charComparison, lineContext);
    };

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
    const focusedCharDiff = writeOneCharDiff(focusedCharComparison);
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
      const charDiff = writeOneCharDiff(charNode.comparison);
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
    const overflowLeft = focusedCharIndex - previousCharAttempt > 0;
    const overflowRight =
      focusedCharIndex + nextCharAttempt < charNodes.length - 1;

    const stringNode = lineNode.parent;
    const stringComparison = stringNode.comparison;

    let lineContent = "";
    lineContent += charBeforeArray.reverse().join("");
    lineContent += focusedCharDiff;
    lineContent += charAfterArray.join("");
    const delimitersColor = getDelimitersColor(lineContext, lineComparison);
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
    if (context.collapsed || context.collapsedWithOverview) {
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

    const actualInternalOrSelfNode = comparison.actualNode
      ? comparison.actualNode.childNodes.internalValue || comparison.actualNode
      : null;
    const expectedInternalOrSelfNode = comparison.expectedNode
      ? comparison.expectedNode.childNodes.internalValue ||
        comparison.expectedNode
      : null;
    const resetModified =
      actualInternalOrSelfNode &&
      actualInternalOrSelfNode.canHaveLines &&
      expectedInternalOrSelfNode &&
      expectedInternalOrSelfNode.canHaveLines;

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
      const focusedCharIndex = getFocusedCharIndex(
        firstLineComparison,
        context,
      );
      const firstLineContext = { ...context };
      return writeOneLineDiff(firstLineComparison, firstLineContext, {
        focusedCharIndex,
        resetModified,
      });
    }

    multiline: {
      let focusedLineIndex = lineComparisons.findIndex((lineComparison) => {
        return lineComparison.counters.overall.any > 0;
      });
      if (focusedLineIndex === -1) {
        focusedLineIndex = lineNodes.length - 1;
      }
      const focusedLineComparison = lineComparisons[focusedLineIndex];
      const focusedCharIndex = getFocusedCharIndex(
        focusedLineComparison,
        context,
      );
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
        const delimitersColor = getDelimitersColor(context, lineComparison);

        let lineDiff = "";
        const lineNumberString = String(lineComparison.index + 1);
        if (String(biggestLineNumber).length > lineNumberString.length) {
          lineDiff += " ";
        }
        lineDiff += ANSI.color(lineNumberString, delimitersColor);
        // lineDiff += " ";
        lineDiff += ANSI.color("|", delimitersColor);
        lineDiff += " ";

        lineDiff += writeOneLineDiff(lineComparison, context, {
          focusedCharIndex,
          resetModified,
        });
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
    let internalValueComparisonToDisplay =
      comparison.childComparisons.internalValue;
    let prototypeComparisonToDisplay = comparison.childComparisons.prototype;
    let propIndex = 0;

    return () => {
      if (internalValueComparisonToDisplay) {
        const internalValueNode =
          internalValueComparisonToDisplay[context.resultType];
        if (!internalValueNode || internalValueNode.inConstructor) {
          internalValueComparisonToDisplay = null;
        } else {
          let insideComparison = internalValueComparisonToDisplay;
          internalValueComparisonToDisplay = null;
          return insideComparison;
        }
      }
      if (prototypeComparisonToDisplay) {
        let insideComparison = prototypeComparisonToDisplay;
        prototypeComparisonToDisplay = null;
        return insideComparison;
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
      const colorWhenModified =
        context.resultType === "actualNode" ? unexpectedColor : expectedColor;
      const { actualNode, expectedNode } = comparison;
      if (!actualNode || !expectedNode) {
        return colorWhenModified;
      }
      if (forWhat === "constructor_new") {
        const actualUseNew =
          actualNode.subtype === "String" ||
          actualNode.subtype === "Boolean" ||
          actualNode.subtype === "Number";
        const expectedUseNew =
          expectedNode.subtype === "String" ||
          expectedNode.subtype === "Boolean" ||
          expectedNode.subtype === "Number";
        return actualUseNew === expectedUseNew ? sameColor : colorWhenModified;
      }
      if (forWhat === "subtype") {
        if (
          actualNode.isComposite &&
          expectedNode.isComposite &&
          actualNode.subtype === expectedNode.subtype
        ) {
          return sameColor;
        }
        if (
          actualNode.isComposite === expectedNode.isComposite &&
          actualNode.canHaveLines &&
          expectedNode.canHaveLines
        ) {
          return sameColor;
        }
        return colorWhenModified;
      }
      if (forWhat === "constructor_parenthesis") {
        const getConstructorParenthesis = (node) => {
          if (!node.isComposite) {
            return "";
          }
          if (context.collapsed) {
            if (node.subtype === "Object" && actualNode.keys.length === 0) {
              return "";
            }
            return "(";
          }
          if (node.subtype === "Array" || node.subtype === "Object") {
            return "";
          }
          return "(";
        };
        const actualConsructorParenthesis =
          getConstructorParenthesis(actualNode);
        const expectedConsructorParenthesis =
          getConstructorParenthesis(expectedNode);
        if (actualConsructorParenthesis === expectedConsructorParenthesis) {
          return sameColor;
        }
        return colorWhenModified;
      }
      const actualInternalOrSelfNode =
        actualNode.childNodes.internalValue || actualNode;
      const expectedInternalOrSelfNode =
        expectedNode.childNodes.internalValue || expectedNode;
      if (forWhat === "constructor_arg") {
        if (
          actualInternalOrSelfNode.isSet &&
          expectedInternalOrSelfNode.isSet
        ) {
          const actualSet = actualInternalOrSelfNode.value;
          const expectedSet = expectedInternalOrSelfNode.value;
          if (context.resultType === "actualNode") {
            for (const actualValue of actualSet) {
              if (!expectedSet.has(actualValue)) {
                return addedColor;
              }
            }
            return sameColor;
          }
          for (const expectedValue of expectedSet) {
            if (!actualSet.has(expectedValue)) {
              return removedColor;
            }
          }
          return sameColor;
        }
      }
      if (forWhat === "bracket") {
        if (
          actualInternalOrSelfNode.isComposite &&
          expectedInternalOrSelfNode.isComposite
        ) {
          const actualOpenBracket =
            actualInternalOrSelfNode.isArray || actualInternalOrSelfNode.isSet
              ? "["
              : "{";
          const expectedOpenBracket =
            expectedInternalOrSelfNode.isArray ||
            expectedInternalOrSelfNode.isSet
              ? "["
              : "{";
          if (actualOpenBracket === expectedOpenBracket) {
            // they use same brackets
            return sameColor;
          }
        }
        if (
          actualInternalOrSelfNode.isString &&
          expectedInternalOrSelfNode.isString
        ) {
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
        if (
          actualInternalOrSelfNode.isComposite ===
          expectedInternalOrSelfNode.isComposite
        ) {
          return sameColor;
        }
      }
      const internalOrSelfNode =
        actualInternalOrSelfNode.type === "internal_value"
          ? actualInternalOrSelfNode
          : expectedInternalOrSelfNode;
      if (internalOrSelfNode.comparison.counters.overall.any === 0) {
        return sameColor;
      }
      return colorWhenModified;
    }
    return sameColor;
  };
  const getSubtypeColor = (context, comparison) => {
    return getColorFor("subtype", context, comparison);
  };
  const getConstructorNewColor = (context, comparison) => {
    return getColorFor("constructor_new", context, comparison);
  };
  const getConstructorArgColor = (context, comparison) => {
    return getColorFor("constructor_arg", context, comparison);
  };
  const getConstructorParenthesisColor = (context, comparison) => {
    return getColorFor("constructor_parenthesis", context, comparison);
  };
  const getBracketColor = (context, comparison) => {
    return getColorFor("bracket", context, comparison);
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

const NAME_TO_CHILD_NODES_META = {
  indexedValues: {
    can: "canHaveIndexedValues",
  },
  urlParts: {
    can: "canHaveUrlParts",
  },
  properties: {
    can: "canHaveProps",
  },
  lines: {
    can: "canHaveLines",
  },
  chars: {
    can: "canHaveChars",
  },
};
const getSelfOrInternalNodes = (node, name) => {
  if (!node) {
    return null;
  }
  const { can } = NAME_TO_CHILD_NODES_META[name];
  if (node[can]) {
    return node.childNodes[name];
  }
  const internalValueNode = node.childNodes.internalValue;
  if (internalValueNode && internalValueNode[can]) {
    return internalValueNode.childNodes[name];
  }
  return null;
};

const getFocusedCharIndex = (comparison, context) => {
  const node = comparison[context.resultType];
  const charComparisons = comparison.childComparisons.chars;
  const charWithDiffIndex = node.childNodes.chars.findIndex((_, index) => {
    const charComparison = charComparisons[index];
    return charComparison.counters.overall.any > 0;
  });
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
