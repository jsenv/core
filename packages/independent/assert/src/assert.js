import stringWidth from "string-width";
import Graphemer from "graphemer";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isAssertionError, createAssertionError } from "./assertion_error.js";
import { analyseFunction } from "./function_analysis.js";

const removedSign = UNICODE.FAILURE_RAW;
const addedSign = UNICODE.FAILURE_RAW;
const unexpectSign = UNICODE.FAILURE_RAW;
const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectColor = ANSI.RED;
const expectColor = ANSI.GREEN;
const unexpectSignColor = ANSI.GREY;
const removedSignColor = ANSI.GREY;
const addedSignColor = ANSI.GREY;
const ARRAY_EMPTY_VALUE = { array_empty_value: true }; // Symbol.for('array_empty_value') ?
// const VALUE_OF_NOT_FOUND = { value_of_not_found: true };
// const DOES_NOT_EXISTS = { does_not_exists: true };

const sourceCodeSymbol = Symbol.for("source_code");
const createSourceCode = (value) => {
  return {
    [sourceCodeSymbol]: value,
  };
};

export const createAssert = ({ format = (v) => v } = {}) => {
  const assert = (...args) => {
    // param validation
    let firstArg;
    let actualIsFirst;
    {
      if (args.length === 0) {
        throw new Error(
          `assert must be called with { actual, expect }, missing first argument`,
        );
      }
      if (args.length > 1) {
        throw new Error(
          `assert must be called with { actual, expect }, received too many arguments`,
        );
      }
      firstArg = args[0];
      if (typeof firstArg !== "object" || firstArg === null) {
        throw new Error(
          `assert must be called with { actual, expect }, received ${firstArg} as first argument instead of object`,
        );
      }
      if ("actual" in firstArg === false) {
        throw new Error(
          `assert must be called with { actual, expect }, missing actual property on first argument`,
        );
      }
      if ("expect" in firstArg === false) {
        throw new Error(
          `assert must be called with { actual, expect }, missing expect property on first argument`,
        );
      }
    }

    const {
      colors = true,
      actual,
      expect,
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
    //   Object.keys(firstArg).indexOf("expect");
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
      quoteOption: quote,
    });
    const expectReferenceMap = new Map();
    const getExpectReference = (value, node) => {
      const reference = expectReferenceMap.get(value);
      if (reference) {
        reference.referenceFromOthersSet.add(node);
      } else {
        expectReferenceMap.set(value, node);
      }
      return reference;
    };
    const expectNode = createValueNode({
      name: "expect",
      value: expect,
      getReference: getExpectReference,
      quoteOption: quote,
    });
    const causeCounters = {
      total: 0,
      displayed: 0,
    };
    const causeSet = new Set();
    const addCause = (comparison) => {
      if (causeSet.has(comparison)) {
        throw new Error("nope");
      }
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
      if (comparison.type === "property_key") {
        return;
      }
      if (comparison.type === "property_descriptor") {
        const ownerComparison = comparison.parent.parent;
        if (!comparison.actualNode && !ownerComparison.actualNode) {
          return;
        }
        if (!comparison.expectNode && !ownerComparison.expectNode) {
          return;
        }
      }
      if (comparison.hidden) {
        return;
      }
      if (
        comparison.type === "prototype" &&
        comparison.actualNode &&
        comparison.actualNode.parent.isFunction &&
        comparison.expectNode &&
        comparison.expectNode.parent.isFunction
      ) {
        // when function prototype differ
        // the diff is already detected by isAsync/isGenerator
        // or functionAnalysis.type
        return;
      }
      // reference to something already counted should not be counted again
      // (happen with class.prototype.constructor referencing the class itself for example)
      referenced: {
        const actualReference =
          comparison.actualNode && comparison.actualNode.reference;
        if (actualReference && causeSet.has(actualReference.comparison)) {
          return;
        }
        const expectReference =
          comparison.expectNode && comparison.expectNode.reference;
        if (expectReference && causeSet.has(expectReference.comparison)) {
          return;
        }
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
    const onComparisonDisplayed = (comparison, skipped) => {
      if (causeSet.has(comparison)) {
        causeSet.delete(comparison);
        causeCounters.displayed++;
      }
      if (skipped) {
        const childComparisons = comparison.childComparisons;
        for (const childComparisonName of Object.keys(childComparisons)) {
          const childComparisonValue = childComparisons[childComparisonName];
          if (!childComparisonValue) {
            continue;
          }
          if (Array.isArray(childComparisonValue)) {
            childComparisonValue.forEach((childComparison) => {
              onComparisonDisplayed(childComparison, true);
            });
            continue;
          }
          if (
            childComparisonValue.actualNode ||
            childComparisonValue.expectNode
          ) {
            onComparisonDisplayed(childComparisonValue, true);
            continue;
          }
          for (const childComparison of Object.values(childComparisonValue)) {
            onComparisonDisplayed(childComparison, true);
          }
        }
      }
    };

    const appendReasons = (reasonSet, ...otherReasonSets) => {
      for (const otherReasonSet of otherReasonSets) {
        for (const reason of otherReasonSet) {
          reasonSet.add(reason);
        }
      }
    };
    const appendReasonGroup = (reasonGroup, otherReasonGroup) => {
      appendReasons(reasonGroup.any, otherReasonGroup.any);
      appendReasons(reasonGroup.removed, otherReasonGroup.removed);
      appendReasons(reasonGroup.added, otherReasonGroup.added);
      appendReasons(reasonGroup.modified, otherReasonGroup.modified);
    };
    const settleReasons = (comparison) => {
      const { reasons } = comparison;
      const { self, inside, overall } = reasons;
      appendReasons(self.any, self.modified, self.removed, self.added);
      appendReasons(inside.any, inside.modified, inside.removed, inside.added);
      appendReasons(overall.removed, self.removed, inside.removed);
      appendReasons(overall.added, self.added, inside.added);
      appendReasons(overall.modified, self.modified, inside.modified);
      appendReasons(overall.any, self.any, inside.any);

      comparison.selfHasRemoval = self.removed.size > 0;
      comparison.selfHasAddition = self.added.size > 0;
      comparison.selfHasModification = self.modified.size > 0;
      comparison.hasAnyDiff = overall.any.size > 0;
      comparison.done = true;
    };

    const compare = (comparison, options = {}) => {
      const { actualNode, expectNode } = comparison;

      let nodePresent;
      added_or_removed: {
        const onMissing = (reason) => {
          const reasonType =
            nodePresent.name === "actual" ? "added" : "removed";
          comparison.reasons.self[reasonType].add(reason);
          comparison[reasonType] = true;
          addCause(comparison);
        };

        let missingNodeName;
        if (actualNode && expectNode) {
          if (
            actualNode.type === "internal_value" &&
            expectNode.type !== "internal_value" &&
            actualNode.parent.isSymbol
          ) {
            nodePresent = actualNode;
            comparison.reasons.self.added.add("internal_value");
            comparison["internal_value"] = true;
            break added_or_removed;
          }
          if (
            actualNode.type !== "internal_value" &&
            expectNode.type === "internal_value" &&
            expectNode.parent.isSymbol
          ) {
            nodePresent = expectNode;
            comparison.reasons.self.removed.add("internal_value");
            comparison["internal_value"] = true;
            break added_or_removed;
          }
          nodePresent = expectNode;
          break added_or_removed;
        }

        if (!actualNode) {
          missingNodeName = "actualNode";
          nodePresent = expectNode;
        } else if (!expectNode) {
          missingNodeName = "expectNode";
          nodePresent = actualNode;
        }

        let ownerComparison;
        if (
          nodePresent.type === "property_descriptor" ||
          nodePresent.type === "property_key" ||
          nodePresent.type === "map_entry_key" ||
          nodePresent.type === "map_entry_value" ||
          nodePresent.type === "char"
        ) {
          const parentComparison = comparison.parent;
          ownerComparison = parentComparison.parent;
        } else {
          ownerComparison = comparison.parent;
        }
        if (!ownerComparison) {
          break added_or_removed;
        }
        const otherOwnerNode = ownerComparison[missingNodeName];
        if (!otherOwnerNode) {
          break added_or_removed;
        }

        if (nodePresent.isArrayIndex) {
          if (otherOwnerNode.canHaveIndexedValues) {
            onMissing(nodePresent.property);
          }
        } else if (nodePresent.type === "property_key") {
          if (otherOwnerNode.canHaveProps) {
            onMissing(nodePresent.value);
          }
        } else if (
          nodePresent.type === "property_descriptor" ||
          nodePresent.type === "property" ||
          nodePresent.type === "prototype"
        ) {
          if (otherOwnerNode.canHaveProps) {
            onMissing(nodePresent.property || "__proto__");
          }
        } else if (nodePresent.type === "set_value") {
          const ownerSetComparison = ownerComparison.parent;
          const ownerSetNode = ownerSetComparison[missingNodeName];
          if (ownerSetNode && ownerSetNode.isSet) {
            if (!ownerSetNode.value.has(nodePresent.value)) {
              onMissing(nodePresent.value);
            }
          }
        } else if (nodePresent.type === "map_entry_key") {
          if (otherOwnerNode.canHaveProps) {
            if (nodePresent.isComposite) {
              onMissing(nodePresent.value);
            } else {
              onMissing(nodePresent.value);
            }
          }
        } else if (nodePresent.type === "map_entry_value") {
          if (otherOwnerNode.canHaveProps) {
            onMissing(nodePresent.value);
          }
        } else if (nodePresent.type === "line") {
          if (otherOwnerNode.isString && otherOwnerNode.type !== "url_part") {
            onMissing(otherOwnerNode.index);
          }
        } else if (nodePresent.type === "char") {
          if (otherOwnerNode.canHaveLines) {
            onMissing(otherOwnerNode.index);
          }
        } else if (ownerComparison.type === "internal_value") {
          onMissing("internal_value");
        }
      }

      const compareInside = (insideComparison, insideOptions = {}) => {
        const insideActualNode = insideComparison.actualNode;
        const insideExpectNode = insideComparison.expectNode;
        compare(insideComparison, { ...options, ...insideOptions });
        if (insideComparison.hasAnyDiff) {
          appendReasonGroup(
            comparison.reasons.inside,
            insideComparison.reasons.overall,
          );
        } else if (insideActualNode && insideExpectNode) {
          const actualShouldHideBecauseNoDiff =
            insideActualNode.showOnlyWhenDiff;
          const expectShouldHideBecauseNoDiff =
            insideExpectNode.showOnlyWhenDiff;
          if (actualShouldHideBecauseNoDiff && expectShouldHideBecauseNoDiff) {
            insideComparison.hidden = true;
          }
        }
      };

      const actualNodeForKeyComparison = actualNode
        ? actualNode.childNodes.key
        : null;
      const expectNodeForKeyComparison = expectNode
        ? expectNode.childNodes.key
        : null;
      if (actualNodeForKeyComparison || expectNodeForKeyComparison) {
        const keyComparison = createComparison(
          actualNodeForKeyComparison,
          expectNodeForKeyComparison,
        );
        comparison.childComparisons.key = keyComparison;
        compareInside(keyComparison);
      }
      if (
        nodePresent.type === "property" ||
        nodePresent.type === "map_entry" ||
        nodePresent.type === "set_value"
      ) {
        const getChildName = (node, childName) => {
          if (!node) {
            return null;
          }
          if (
            node.type === "set_value" &&
            childName === "value" &&
            actualNode &&
            expectNode
          ) {
            const otherNode = node === actualNode ? expectNode : actualNode;
            if (otherNode.type === "property") {
              return node;
            }
            return null;
          }
          return node.childNodes[childName];
        };
        const childComparisons = comparison.childComparisons;
        const actualUsePropertyAccessor = Boolean(
          getChildName(actualNode, "get") || getChildName(actualNode, "set"),
        );
        const expectUsePropertyAccessor = Boolean(
          getChildName(expectNode, "get") || getChildName(expectNode, "set"),
        );
        const childsToCompare = [
          "value",
          "get",
          "set",
          "enumerable",
          "writable",
          "configurable",
        ];
        for (const childName of childsToCompare) {
          const actualChildNode = getChildName(actualNode, childName);
          const expectChildNode = getChildName(expectNode, childName);
          if (!actualChildNode && !expectChildNode) {
            continue;
          }
          const childComparison = createComparison(
            actualChildNode,
            expectChildNode,
          );
          if (childName === "writable") {
            if (actualUsePropertyAccessor !== expectUsePropertyAccessor) {
              // when one uses property accessor and the other not
              // the diff on writable would be redundant to display
              childComparison.hidden = true;
            }
          }
          childComparisons[childName] = childComparison;
          compareInside(childComparison);
        }
        if (
          nodePresent.type === "property" ||
          nodePresent.type === "map_entry"
        ) {
          settleReasons(comparison);
          return;
        }
      }

      const addSelfDiff = (reason) => {
        if (!comparison.hidden) {
          comparison.reasons.self.modified.add(reason);
          if (comparison.reasons.self.modified.size === 1) {
            addCause(comparison);
          }
        }
      };

      let ignoreInternalValueDiff = false;
      let ignoreCharsDiff =
        actualNode &&
        !actualNode.canHaveChars &&
        expectNode &&
        !expectNode.canHaveChars;
      let ignoreUrlPartsDiff =
        actualNode &&
        !actualNode.canHaveUrlParts &&
        expectNode &&
        !expectNode.canHaveUrlParts;

      if (actualNode && expectNode) {
        if (
          actualNode.reference &&
          expectNode.reference &&
          actualNode.reference.path.toString() !==
            expectNode.reference.path.toString()
        ) {
          addSelfDiff("reference");
        } else if (actualNode.wellKnownId !== expectNode.wellKnownId) {
          addSelfDiff("wellKnownId");
        } else if (actualNode.isPrimitive !== expectNode.isPrimitive) {
          addSelfDiff("primitive");
        } else if (
          actualNode.isPrimitive &&
          expectNode.isPrimitive &&
          actualNode.value !== expectNode.value
        ) {
          addSelfDiff("primitiveValue");
        } else if (actualNode.isSourceCode !== expectNode.isSourceCode) {
          addSelfDiff("sourceCode");
        } else if (actualNode.isSourceCode && expectNode.isSourceCode) {
          if (
            actualNode.parent.functionAnalysis.type ===
              expectNode.parent.functionAnalysis.type &&
            actualNode.value[sourceCodeSymbol] !==
              expectNode.value[sourceCodeSymbol]
          ) {
            addSelfDiff("sourceCodeValue");
          }
        } else if (actualNode.subtype !== expectNode.subtype) {
          if (
            actualNode.isFunctionPrototype &&
            expectNode.isFunctionPrototype
          ) {
            // subtype diff is expected and will be rendered in the function diff
            // function A() {} already states that subtype differs from
            // function B() {}
          } else {
            addSelfDiff("subtype");
          }
        } else if (actualNode.isFunction && expectNode.isFunction) {
          if (
            actualNode.functionAnalysis.isAsync !==
            expectNode.functionAnalysis.isAsync
          ) {
            addSelfDiff("isAsync");
          }
          if (
            actualNode.functionAnalysis.isGenerator !==
            expectNode.functionAnalysis.isGenerator
          ) {
            addSelfDiff("isGenerator");
          }
          if (
            actualNode.functionAnalysis.type !==
            expectNode.functionAnalysis.type
          ) {
            addSelfDiff("functionType");
          }
          if (
            actualNode.functionAnalysis.name !==
            expectNode.functionAnalysis.name
          ) {
            addSelfDiff("functionName");
          }
          if (actualNode.extendedClassName !== expectNode.extendedClassName) {
            addSelfDiff("extendedClassName");
          }
        }

        props_frozen_or_sealed_or_non_extensible: {
          if (actualNode.propsFrozen !== expectNode.propsFrozen) {
            addSelfDiff("propsFrozen");
          } else if (actualNode.propsSealed !== expectNode.propsSealed) {
            addSelfDiff("propsSealed");
          } else if (
            actualNode.propsExtensionsPrevented !==
            expectNode.propsExtensionsPrevented
          ) {
            addSelfDiff("propsExtensionsPrevented");
          }
        }
        prototype: {
          const actualPrototypeNode = actualNode
            ? actualNode.childNodes.prototype
            : null;
          const expectPrototypeNode = expectNode
            ? expectNode.childNodes.prototype
            : null;
          if (!actualPrototypeNode && !expectPrototypeNode) {
            break prototype;
          }
          const prototypeComparison = createComparison(
            actualPrototypeNode,
            expectPrototypeNode,
          );
          let prototypeCanBeInfered;
          if (!actualPrototypeNode) {
            prototypeCanBeInfered = true;
          } else if (!expectPrototypeNode) {
            prototypeCanBeInfered = true;
          } else if (actualPrototypeNode && expectPrototypeNode) {
            if (
              // prototype can be infered by
              // - the subtype
              //    actual: User {}
              //    expect: Animal {}
              comparison.reasons.self.modified.has("subtype") ||
              // - the function type
              //    actual: () => {}
              //    expect: function () {}
              comparison.reasons.self.modified.has("functionType") ||
              // - the usage of async/generator
              //   actual: function () {}
              //   expect: async function () {}
              comparison.reasons.self.modified.has("isAsync") ||
              comparison.reasons.self.modified.has("isGenerator") ||
              // prototype property can be infered thanks to the usage of extends
              // (nan c'est le proto ça)
              // - the usage of extends keyword
              //   actual: class A extends Human {}
              //   expect: class B extends Robot {}
              comparison.reasons.self.modified.has("extendedClassName")
            ) {
              prototypeCanBeInfered = true;
            }
          }
          if (prototypeCanBeInfered) {
            prototypeComparison.hidden = true;
          }
          comparison.childComparisons.prototype = prototypeComparison;
          compareInside(prototypeComparison);
        }
      }

      const actualInternalValueNode = actualNode
        ? actualNode.childNodes.internalValue
        : null;
      const expectInternalValueNode = expectNode
        ? expectNode.childNodes.internalValue
        : null;
      internal_value: {
        if (ignoreInternalValueDiff) {
          break internal_value;
        }
        if (!actualInternalValueNode && !expectInternalValueNode) {
          break internal_value;
        }
        let internalValueComparison;
        const actualInternalOrSelfNode = actualInternalValueNode || actualNode;
        const expectInternalOrSelfNode = expectInternalValueNode || expectNode;
        internalValueComparison = createComparison(
          actualInternalOrSelfNode,
          expectInternalOrSelfNode,
        );
        comparison.childComparisons.internalValue = internalValueComparison;
        compareInside(internalValueComparison);
      }

      inside: {
        string: {
          lines: {
            if (
              actualNode &&
              !actualNode.canHaveLines &&
              expectNode &&
              !expectNode.canHaveLines
            ) {
              // prevent to compare twice when internal can have
              // but wrapper cannot
              break lines;
            }
            const actualNodeWhoCanHaveLines = pickSelfOrInternalNode(
              actualNode,
              (node) => node.canHaveLines,
            );
            const expectNodeWhoCanHaveLines = pickSelfOrInternalNode(
              expectNode,
              (node) => node.canHaveLines,
            );
            if (!actualNodeWhoCanHaveLines && !expectNodeWhoCanHaveLines) {
              break lines;
            }
            const actualLineNodes = actualNodeWhoCanHaveLines
              ? actualNodeWhoCanHaveLines.childNodes.lines
              : [];
            const expectLineNodes = expectNodeWhoCanHaveLines
              ? expectNodeWhoCanHaveLines.childNodes.lines
              : [];
            const lineComparisons = comparison.childComparisons.lines;

            let lineIndex = 0;
            for (const actualLineNode of actualLineNodes) {
              const expectLineNode = expectLineNodes[lineIndex];
              const lineComparison = createComparison(
                actualLineNode,
                expectLineNode,
              );
              lineComparisons[lineIndex] = lineComparison;
              compareInside(lineComparison);
              lineIndex++;
            }
            while (lineIndex < expectLineNodes.length) {
              const lineComparison = createComparison(
                null,
                expectLineNodes[lineIndex],
              );
              lineComparisons[lineIndex] = lineComparison;
              compareInside(lineComparison);
              lineIndex++;
            }
          }
          chars: {
            if (ignoreCharsDiff) {
              break chars;
            }
            const actualNodeWhoCanHaveChars = pickSelfOrInternalNode(
              actualNode,
              (node) => node.canHaveChars,
            );
            const expectNodeWhoCanHaveChars = pickSelfOrInternalNode(
              expectNode,
              (node) => node.canHaveChars,
            );
            if (!actualNodeWhoCanHaveChars && !expectNodeWhoCanHaveChars) {
              break chars;
            }
            const actualCharNodes = actualNodeWhoCanHaveChars
              ? actualNodeWhoCanHaveChars.childNodes.chars
              : [];
            const expectCharNodes = expectNodeWhoCanHaveChars
              ? expectNodeWhoCanHaveChars.childNodes.chars
              : [];
            const charComparisons = comparison.childComparisons.chars;

            const visitCharNode = (charNode) => {
              const charNodeIndex = charNode.index;
              const actualCharNode = actualCharNodes[charNodeIndex];
              const expectCharNode = expectCharNodes[charNodeIndex];
              const charComparison = createComparison(
                actualCharNode,
                expectCharNode,
              );
              charComparisons[charNodeIndex] = charComparison;
              compareInside(charComparison);
            };
            for (const actualCharNode of actualCharNodes) {
              visitCharNode(actualCharNode);
            }
            for (const expectCharNode of expectCharNodes) {
              if (!charComparisons[expectCharNode.index]) {
                visitCharNode(expectCharNode);
              }
            }
          }
        }
        url_parts: {
          if (ignoreUrlPartsDiff) {
            break url_parts;
          }
          const actualNodeWhoCanHaveUrlParts = pickSelfOrInternalNode(
            actualNode,
            (node) => node.canHaveUrlParts,
          );
          const expectNodeWhoCanHaveUrlParts = pickSelfOrInternalNode(
            expectNode,
            (node) => node.canHaveUrlParts,
          );
          if (!actualNodeWhoCanHaveUrlParts && !expectNodeWhoCanHaveUrlParts) {
            break url_parts;
          }
          const actualUrlPartNodes = actualNodeWhoCanHaveUrlParts
            ? actualNodeWhoCanHaveUrlParts.childNodes.urlParts
            : {};
          const expectUrlPartNodes = expectNodeWhoCanHaveUrlParts
            ? expectNodeWhoCanHaveUrlParts.childNodes.urlParts
            : {};
          const urlPartComparisons = comparison.childComparisons.urlParts;

          const visitUrlPart = (urlPartName) => {
            const actualUrlPartNode = actualUrlPartNodes[urlPartName];
            const expectUrlPartNode = expectUrlPartNodes[urlPartName];
            const urlPartComparison = createComparison(
              actualUrlPartNode,
              expectUrlPartNode,
            );
            urlPartComparisons[urlPartName] = urlPartComparison;
            compareInside(urlPartComparison);
          };
          for (const actualUrlPartName of Object.keys(actualUrlPartNodes)) {
            visitUrlPart(actualUrlPartName);
          }
          for (const expectUrlPartName of Object.keys(expectUrlPartNodes)) {
            if (!urlPartComparisons[expectUrlPartName]) {
              visitUrlPart(expectUrlPartName);
            }
          }
        }

        let actualIndexedPropertyNodeMap;
        let expectIndexedPropertyNodeMap;
        let actualNamedPropertyNodeMap;
        let expectNamedPropertyNodeMap;
        let actualMapEntryNodeMap;
        let expectMapEntryNodeMap;
        if (
          actualNode &&
          !actualNode.canHaveIndexedValues &&
          expectNode &&
          !expectNode.canHaveIndexedValues
        ) {
          // prevent to compare twice when internal can have
          // but wrapper cannot
          actualIndexedPropertyNodeMap = new Map();
          expectIndexedPropertyNodeMap = new Map();
        } else {
          const actualNodeWhoCanHaveIndexedValues = pickSelfOrInternalNode(
            actualNode,
            (node) => node.canHaveIndexedValues,
          );
          const expectNodeWhoCanHaveIndexedValues = pickSelfOrInternalNode(
            expectNode,
            (node) => node.canHaveIndexedValues,
          );
          actualIndexedPropertyNodeMap = actualNodeWhoCanHaveIndexedValues
            ? actualNodeWhoCanHaveIndexedValues.childNodes.indexedPropertyMap
            : new Map();
          expectIndexedPropertyNodeMap = expectNodeWhoCanHaveIndexedValues
            ? expectNodeWhoCanHaveIndexedValues.childNodes.indexedPropertyMap
            : new Map();
        }
        if (
          actualNode &&
          !actualNode.canHaveProps &&
          expectNode &&
          !expectNode.canHaveProps
        ) {
          // prevent to compare twice when internal can have
          // but wrapper cannot
          actualNamedPropertyNodeMap = new Map();
          expectNamedPropertyNodeMap = new Map();
        } else {
          const actualNodeWhoCanHaveNamedProps = pickSelfOrInternalNode(
            actualNode,
            (node) => node.canHaveProps,
          );
          const expectNodeWhoCanHaveNamedProps = pickSelfOrInternalNode(
            expectNode,
            (node) => node.canHaveProps,
          );
          actualNamedPropertyNodeMap = actualNodeWhoCanHaveNamedProps
            ? actualNodeWhoCanHaveNamedProps.childNodes.namedPropertyMap
            : new Map();
          expectNamedPropertyNodeMap = expectNodeWhoCanHaveNamedProps
            ? expectNodeWhoCanHaveNamedProps.childNodes.namedPropertyMap
            : new Map();
        }
        if (
          actualNode &&
          !actualNode.isMap &&
          expectNode &&
          !expectNode.isMap
        ) {
          // prevent to compare twice when internal can have
          // but wrapper cannot
          actualMapEntryNodeMap = new Map();
          expectMapEntryNodeMap = new Map();
        } else {
          const actualNodeWhoCanHaveMapEntries = pickSelfOrInternalNode(
            actualNode,
            (node) => node.isMap,
          );
          const expectNodeWhoCanHaveMapEntries = pickSelfOrInternalNode(
            expectNode,
            (node) => node.isMap,
          );
          actualMapEntryNodeMap = actualNodeWhoCanHaveMapEntries
            ? actualNodeWhoCanHaveMapEntries.childNodes.mapEntryMap
            : new Map();
          expectMapEntryNodeMap = expectNodeWhoCanHaveMapEntries
            ? expectNodeWhoCanHaveMapEntries.childNodes.mapEntryMap
            : new Map();
        }
        const propertyComparisonMap = comparison.childComparisons.propertyMap;
        const mapEntryComparisonMap = comparison.childComparisons.mapEntryMap;

        properties: {
          // indexed properties
          const parentComparison = comparison.parent;
          const isSetComparison =
            parentComparison &&
            parentComparison.actualNode &&
            parentComparison.actualNode.isSet &&
            parentComparison.expectNode &&
            parentComparison.expectNode.isSet;
          if (isSetComparison) {
            let index = 0;
            for (const [
              ,
              actualIndexedPropertyNode,
            ] of actualIndexedPropertyNodeMap) {
              const propertyComparison = createComparison(
                actualIndexedPropertyNode,
                null,
              );
              propertyComparison.index = index;
              propertyComparisonMap.set(index, propertyComparison);
              compareInside(propertyComparison);
              index++;
            }
            for (const [
              ,
              expectIndexedPropertyNode,
            ] of expectIndexedPropertyNodeMap) {
              const propertyComparison = createComparison(
                null,
                expectIndexedPropertyNode,
              );
              propertyComparison.index = index;
              propertyComparisonMap.set(index, propertyComparison);
              compareInside(propertyComparison);
              index++;
            }
          } else {
            let index = 0;
            for (const [
              ,
              actualIndexedPropertyNode,
            ] of actualIndexedPropertyNodeMap) {
              let indexString = String(index);
              let expectNodeForComparison;
              if (expectIndexedPropertyNodeMap.has(indexString)) {
                expectNodeForComparison =
                  expectIndexedPropertyNodeMap.get(indexString);
              } else if (expectNamedPropertyNodeMap.size === 0) {
                expectNodeForComparison =
                  expectMapEntryNodeMap.get(index) ||
                  expectMapEntryNodeMap.get(indexString);
              } else {
                expectNodeForComparison =
                  expectNamedPropertyNodeMap.get(indexString);
              }
              const propertyComparison = createComparison(
                actualIndexedPropertyNode,
                expectNodeForComparison,
              );
              propertyComparison.index = index;
              propertyComparisonMap.set(indexString, propertyComparison);
              compareInside(propertyComparison);
              index++;
            }
            // here we know it's an extra index, like "b" in
            // actual: ["a"]
            // expect: ["a", "b"]
            let expectIndexedPropertyNode;
            while (
              (expectIndexedPropertyNode = expectIndexedPropertyNodeMap.get(
                String(index),
              ))
            ) {
              let indexString = String(index);
              let actualNodeForComparison;
              if (actualNamedPropertyNodeMap.size === 0) {
                actualNodeForComparison =
                  actualMapEntryNodeMap.get(index) ||
                  actualMapEntryNodeMap.get(indexString);
              } else {
                actualNodeForComparison =
                  actualNamedPropertyNodeMap.get(indexString);
              }
              const propertyComparison = createComparison(
                actualNodeForComparison,
                expectIndexedPropertyNode,
              );
              propertyComparison.index = index;
              propertyComparisonMap.set(indexString, propertyComparison);
              compareInside(propertyComparison);
              index++;
            }
          }

          // named properties
          for (const [
            actualProperty,
            actualNamedPropertyNode,
          ] of actualNamedPropertyNodeMap) {
            if (propertyComparisonMap.has(actualProperty)) {
              // can happen for
              // actual: {0: 'b'}
              // expect: ['b']
              continue;
            }
            let expectNodeForComparison;
            if (expectNamedPropertyNodeMap.size === 0) {
              expectNodeForComparison =
                expectMapEntryNodeMap.get(actualProperty);
            } else {
              expectNodeForComparison =
                expectNamedPropertyNodeMap.get(actualProperty) ||
                expectIndexedPropertyNodeMap.get(actualProperty);
            }
            const propertyComparison = createComparison(
              actualNamedPropertyNode,
              expectNodeForComparison,
            );
            propertyComparisonMap.set(actualProperty, propertyComparison);
            compareInside(propertyComparison);
          }
          for (const [
            expectProperty,
            expectNamedPropertyNode,
          ] of expectNamedPropertyNodeMap) {
            if (propertyComparisonMap.has(expectProperty)) {
              continue;
            }
            // we know it's an extra named property here
            let actualNodeForComparison;
            if (actualNamedPropertyNodeMap.size === 0) {
              actualNodeForComparison =
                expectMapEntryNodeMap.get(expectProperty);
            }
            const propertyComparison = createComparison(
              actualNodeForComparison,
              expectNamedPropertyNode,
            );
            propertyComparisonMap.set(expectProperty, propertyComparison);
            compareInside(propertyComparison);
          }
        }
        map_entries: {
          for (const [
            actualMapEntryKey,
            actualMapEntryNode,
          ] of actualMapEntryNodeMap) {
            let expectNodeForComparison;
            if (expectMapEntryNodeMap.has(actualMapEntryKey)) {
              expectNodeForComparison =
                expectMapEntryNodeMap.get(actualMapEntryKey);
            } else if (isComposite(actualMapEntryKey)) {
            } else if (actualNamedPropertyNodeMap.size === 0) {
              let namedProperty =
                typeof actualMapEntryKey === "number"
                  ? String(actualMapEntryKey)
                  : actualMapEntryKey;
              expectNodeForComparison =
                expectIndexedPropertyNodeMap.get(namedProperty) ||
                expectNamedPropertyNodeMap.get(namedProperty);
            }
            const mapEntryComparison = createComparison(
              actualMapEntryNode,
              expectNodeForComparison,
            );
            mapEntryComparisonMap.set(actualMapEntryKey, mapEntryComparison);
            compareInside(mapEntryComparison);
          }
          for (const [
            expectMapEntryKey,
            expectMapEntryNode,
          ] of expectMapEntryNodeMap) {
            if (mapEntryComparisonMap.has(expectMapEntryKey)) {
              continue;
            }
            let actualNodeForComparison;
            if (isComposite(expectMapEntryKey)) {
            } else if (expectNamedPropertyNodeMap.size === 0) {
              let namedProperty =
                typeof expectMapEntryKey === "number"
                  ? String(expectMapEntryKey)
                  : expectMapEntryKey;
              actualNodeForComparison =
                actualIndexedPropertyNodeMap.get(namedProperty) ||
                actualNamedPropertyNodeMap.get(namedProperty);
            }
            const mapEntryComparison = createComparison(
              actualNodeForComparison,
              expectMapEntryNode,
            );
            mapEntryComparisonMap.set(expectMapEntryKey, mapEntryComparison);
            compareInside(mapEntryComparison);
          }
        }
      }

      settleReasons(comparison);
    };
    const createComparison = (actualNode, expectNode) => {
      let mainNode;
      let fromInternalValue = false;
      if (actualNode && actualNode.type === "internal_value") {
        mainNode = actualNode;
        fromInternalValue = true;
      } else if (expectNode && expectNode.type === "internal_value") {
        mainNode = expectNode;
        fromInternalValue = true;
      } else {
        mainNode = actualNode || expectNode;
      }

      let actualHidden;
      let expectHidden;
      if (actualNode) {
        actualHidden =
          actualNode.hidden ||
          (actualNode.reference ? actualNode.reference.hidden : false);
      }
      if (expectNode) {
        expectHidden =
          expectNode.hidden ||
          (expectNode.reference ? expectNode.reference.hidden : false);
      }
      let hidden;
      if (actualHidden && expectHidden) {
        hidden = true;
      } else if (actualHidden && !expectNode) {
        hidden = true;
      } else if (expectHidden && !actualNode) {
        hidden = true;
      }

      if (actualNode && expectNode) {
        if (actualNode.isMultiline && !expectNode.isMultiline) {
          expectNode.isMultiline = true;
          expectNode.useQuotes = false;
          if (!expectNode.isErrorMessageString) {
            expectNode.useLineNumbersOnTheLeft = true;
          }
        } else if (!actualNode.isMultiline && expectNode.isMultiline) {
          actualNode.isMultiline = true;
          actualNode.useQuotes = false;
          if (!actualNode.isErrorMessageString) {
            actualNode.useLineNumbersOnTheLeft = true;
          }
        }
        const actualQuote = actualNode.quote;
        const expectQuote = expectNode.quote;
        if (actualQuote === '"') {
          if (expectQuote && expectQuote !== '"') {
            actualNode.quote = expectQuote;
            actualNode.openDelimiter = actualNode.closeDelimiter = expectQuote;
          }
        } else if (actualQuote && actualQuote !== expectQuote) {
          // pick the one in actual
          expectNode.quote = actualQuote;
          expectNode.openDelimiter = expectNode.closeDelimiter = actualQuote;
        }
      }

      // if (actualNode && actualNode.comparison) {
      //   throw new Error("nope");
      // } else if (expectNode && expectNode.comparison) {
      //   throw new Error("nope");
      // }

      const parent = mainNode.parent ? mainNode.parent.comparison : null;

      const comparison = {
        parent,
        actualNode,
        expectNode,

        type: mainNode.type,
        depth: mainNode.depth,
        path: mainNode.path,
        property:
          mainNode.type === "property" ||
          mainNode.type === "property_descriptor"
            ? mainNode.property
            : undefined,
        descriptor:
          mainNode.type === "property_descriptor"
            ? mainNode.descriptor
            : undefined,
        index: mainNode.index,

        reasons: {
          overall: {
            any: new Set(),
            modified: new Set(),
            removed: new Set(),
            added: new Set(),
          },
          self: {
            any: new Set(),
            modified: new Set(),
            removed: new Set(),
            added: new Set(),
          },
          inside: {
            any: new Set(),
            modified: new Set(),
            removed: new Set(),
            added: new Set(),
          },
        },
        hidden,
        childComparisons: {
          prototype: null,
          internalValue: null,
          propertyMap: new Map(),
          mapEntryMap: new Map(),
          key: null,
          value: null,
          enumerable: null,
          writable: null,
          configurable: null,
          set: null,
          get: null,
          lines: [],
          chars: [],
          urlParts: {},
        },
      };

      if (fromInternalValue) {
        if (actualNode && actualNode.type === "internal_value") {
          actualNode.comparison = comparison;
        }
        if (expectNode && expectNode.type === "internal_value") {
          expectNode.comparison = comparison;
        }
      } else {
        if (actualNode) {
          actualNode.comparison = comparison;
        }
        if (expectNode) {
          expectNode.comparison = comparison;
        }
      }

      return comparison;
    };

    const rootComparison = createComparison(actualNode, expectNode);
    compare(rootComparison);
    for (const causeComparison of causeSet) {
      if (causeComparison.type === "property_descriptor") {
        let current = causeComparison.parent.parent;
        while (current) {
          if (current.reasons.self.any.size) {
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
      if (rootComparison.selfHasModification) {
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
          (comparison.type === "property_descriptor" ||
            comparison.type === "map_entry_key" ||
            comparison.type === "map_entry_value" ||
            comparison.type === "set_value") &&
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
      color: unexpectColor,
    };
    const expectValueMeta = {
      resultType: "expectNode",
      name: "expect",
      shortname: "expect",
      color: expectColor,
    };
    const firstValueMeta = actualIsFirst ? actualValueMeta : expectValueMeta;
    const secondValueMeta = actualIsFirst ? expectValueMeta : actualValueMeta;

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
        resultColor: firstValueMeta.color,
        resultColorWhenSolo: addedColor,
        otherResultType: secondValueMeta.resultType,
        textIndent: stringWidth(firstPrefix),
      });
    }
    let secondPrefix = "";
    let secondValueDiff;
    expect_diff: {
      secondPrefix += ANSI.color(secondValueMeta.shortname, sameColor);
      secondPrefix += ANSI.color(":", sameColor);
      secondPrefix += " ";
      secondValueDiff = writeDiff(startComparison, {
        ...contextBase,
        resultType: secondValueMeta.resultType,
        resultColor: secondValueMeta.color,
        resultColorWhenSolo: removedColor,
        otherResultType: firstValueMeta.resultType,
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
    if (rootComparison.selfHasModification) {
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

const shouldIgnorePrototype = (node, prototypeValue) => {
  if (node.isFunction) {
    if (node.functionAnalysis.isAsync) {
      if (node.functionAnalysis.isGenerator) {
        return prototypeValue === AsyncGeneratorFunction.prototype;
      }
      return prototypeValue === AsyncFunction.prototype;
    }
    if (node.functionAnalysis.isGenerator) {
      return prototypeValue === GeneratorFunction.prototype;
    }
    return prototypeValue === Function.prototype;
  }
  if (node.isSet) {
    return prototypeValue === Set.prototype;
  }
  if (node.isMap) {
    return prototypeValue === Map.prototype;
  }
  if (node.isArray) {
    return prototypeValue === Array.prototype;
  }
  return false;
};
const shouldIgnoreProperty = (
  node,
  propertyName,
  { propertyDescriptor, isStringIndex },
) => {
  if (propertyName === "prototype") {
    if (!node.isFunction) {
      return false;
    }
    // ignore prototype if it's the default prototype
    // created by the runtime
    if (!Object.hasOwn(propertyDescriptor, "value")) {
      return false;
    }
    const prototypeValue = propertyDescriptor.value;
    if (node.functionAnalysis.type === "arrow") {
      return prototypeValue === undefined;
    }
    if (node.functionAnalysis.isAsync && !node.functionAnalysis.isGenerator) {
      return prototypeValue === undefined;
    }
    const prototypeValueIsComposite = isComposite(prototypeValue);
    if (!prototypeValueIsComposite) {
      return false;
    }
    const constructorDescriptor = Object.getOwnPropertyDescriptor(
      prototypeValue,
      "constructor",
    );
    if (!constructorDescriptor) {
      return false;
    }
    // the default prototype.constructor is
    // configurable, writable, non enumerable and got a value
    if (
      !constructorDescriptor.configurable ||
      !constructorDescriptor.writable ||
      constructorDescriptor.enumerable ||
      constructorDescriptor.set ||
      constructorDescriptor.get
    ) {
      return false;
    }
    const constructorValue = constructorDescriptor.value;
    if (constructorValue !== node.value) {
      return false;
    }
    const propertyNames = Object.getOwnPropertyNames(prototypeValue);
    return propertyNames.length === 1;
  }
  if (propertyName === "constructor") {
    return (
      node.parent.property === "prototype" &&
      node.parent.parent.isFunction &&
      Object.hasOwn(propertyDescriptor, "value") &&
      propertyDescriptor.value === node.parent.parent.value
    );
  }
  if (propertyName === "length") {
    return node.isArray || node.isStringObject || node.isFunction;
  }
  if (propertyName === "name") {
    return node.isFunction;
  }
  if (propertyName === "stack") {
    return node.isError;
  }
  if (propertyName === "valueOf") {
    return (
      node.childNodes.internalValue &&
      node.childNodes.internalValue.property === "valueOf()"
    );
  }
  if (propertyName === "toString") {
    return (
      node.childNodes.internalValue &&
      node.childNodes.internalValue.property === "toString()"
    );
  }
  if (isStringIndex) {
    return true;
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
  return false;
};
const shouldIgnorePropertyDescriptor = (
  node,
  propertyName,
  propertyDescriptorName,
  propertyDescriptorValue,
) => {
  /* eslint-disable no-unneeded-ternary */
  if (propertyDescriptorName === "writable") {
    const defaultValue =
      propertyName === "prototype" && node.functionAnalysis.type === "class"
        ? false
        : true;
    return propertyDescriptorValue === defaultValue;
  }
  if (propertyDescriptorName === "configurable") {
    const defaultValue =
      propertyName === "prototype" && node.isFunction ? false : true;
    return propertyDescriptorValue === defaultValue;
  }
  if (propertyDescriptorName === "enumerable") {
    const defaultValue =
      (propertyName === "prototype" && node.isFunction) ||
      (propertyName === "message" && node.isError)
        ? false
        : true;
    return propertyDescriptorValue === defaultValue;
  }
  /* eslint-enable no-unneeded-ternary */
  if (propertyDescriptorName === "get") {
    const defaultValue = undefined;
    return propertyDescriptorValue === defaultValue;
  }
  if (propertyDescriptorName === "set") {
    const defaultValue = undefined;
    return propertyDescriptorValue === defaultValue;
  }
  return false;
};

// const isDefaultDescriptor = (descriptorName, descriptorValue) => {
//   if (descriptorName === "enumerable" && descriptorValue === true) {
//     return true;
//   }
//   if (descriptorName === "writable" && descriptorValue === true) {
//     return true;
//   }
//   if (descriptorName === "configurable" && descriptorValue === true) {
//     return true;
//   }
//   if (descriptorName === "get" && descriptorValue === undefined) {
//     return true;
//   }
//   if (descriptorName === "set" && descriptorValue === undefined) {
//     return true;
//   }
//   return false;
// };

let createValueNode;
{
  let nodeId = 1;
  createValueNode = ({ name, value, getReference, quoteOption }) => {
    const _createValueNode = ({
      parent,
      path,
      type,
      value,
      valueSeparator,
      valueEndSeparator,
      isArrayIndex,
      property,
      descriptor,
      index,
      isSourceCode = false,
      isClassProperty = false,
      isClassPrototype = false,
      displayedIn,
      showOnlyWhenDiff = parent && parent.showOnlyWhenDiff === "deep"
        ? "deep"
        : false,
      hidden = parent ? parent.hidden : false,
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
        let subtypeDisplayed;
        let subtypeDisplayedWhenCollapsed;
        let isFunction = false;
        let functionAnalysis = {};
        let extendedClassName = "";
        let isFunctionPrototype = false;
        let isArray = false;
        let isSet = false;
        let isString = false;
        let isStringObject = false;
        let isUrl = false;
        let isUrlString = false;
        let isError = false;
        let isErrorMessageString = false;
        let isMap = false;
        let isSymbol = false;
        let symbolKey = "";
        let symbolDescription = "";
        let reference = null;
        let constructorCall = false;
        let constructorCallUseNew = false;
        let constructorCallOpenDelimiter = "(";
        let constructorCallCloseDelimiter = ")";
        let openDelimiter = "";
        let closeDelimiter = "";
        let quote = "";

        let canHaveProps = false;
        let propsFrozen = false;
        let propsSealed = false;
        let propsExtensionsPrevented = false;
        let canHaveIndexedValues = false;
        let canHaveLines = false;
        let lines = [];
        let isMultiline = false;
        let useLineNumbersOnTheLeft = false;
        let useQuotes = false;
        let canHaveChars = false;
        let chars = [];
        let canHaveUrlParts = false;

        if (value === ARRAY_EMPTY_VALUE) {
          wellKnownId = "empty";
          subtype = "empty";
        } else if (type === "property") {
        } else if (type === "map_entry") {
        }
        // else if (value === DOES_NOT_EXISTS) {
        //   composite = false;
        //   isArray = false;
        //   wellKnownId = "not_found";
        //   subtype = "not_found";
        // }
        else if (
          value &&
          typeof value === "object" &&
          sourceCodeSymbol in value
        ) {
          isSourceCode = true;
          openDelimiter = "{";
          closeDelimiter = "}";
        } else {
          composite = isComposite(value);
          primitive = !composite;
          wellKnownId = getWellKnownId(value);
          if (composite) {
            canHaveProps = true;
            if (Object.isFrozen(value)) {
              propsFrozen = true;
            } else if (Object.isSealed(value)) {
              propsSealed = true;
            } else if (!Object.isExtensible(value)) {
              propsExtensionsPrevented = true;
            }
            if (typeof value === "function") {
              isFunction = true;
              constructorCallOpenDelimiter = "{";
              constructorCallCloseDelimiter = "}";
              functionAnalysis = analyseFunction(value);
              if (functionAnalysis.type === "arrow") {
                if (functionAnalysis.isAsync) {
                  subtype = functionAnalysis.isGenerator
                    ? "AsyncArrowFunction"
                    : "ArrowFunction";
                }
                subtype = functionAnalysis.isGenerator
                  ? "GeneratorArrowFunction"
                  : "ArrowFunction";
              } else if (functionAnalysis.isAsync) {
                subtype = functionAnalysis.isGenerator
                  ? "AsyncGeneratorFunction"
                  : "AsyncFunction";
              }
              subtype = functionAnalysis.isGenerator
                ? "GeneratorFunction"
                : "Function";
              if (functionAnalysis.type === "class") {
                const prototype = Object.getPrototypeOf(value);
                if (prototype && prototype !== Function.prototype) {
                  extendedClassName = prototype.name;
                }
              }
            } else if (
              type === "property_descriptor" &&
              property === "prototype" &&
              parent.parent.isFunction
            ) {
              isFunctionPrototype = true;
              subtype = parent.parent.value.name;
            } else {
              subtype = getSubtype(value);
            }
            reference =
              wellKnownId || type === "prototype"
                ? null
                : getReference(value, node);
            visitPrototypes(value, (proto) => {
              if (proto.constructor) {
                if (proto.constructor.name === "Array") {
                  isArray = true;
                  canHaveIndexedValues = true;
                } else if (proto.constructor.name === "Set") {
                  isSet = true;
                } else if (proto.constructor.name === "String") {
                  isStringObject = true;
                } else if (proto.constructor.name === "URL") {
                  isUrl = true;
                  canHaveUrlParts = true;
                } else if (proto.constructor.name === "Error") {
                  isError = true;
                } else if (proto.constructor.name === "Map") {
                  isMap = true;
                }
              }
            });

            if (
              subtype === "String" ||
              subtype === "Boolean" ||
              subtype === "Number"
            ) {
              constructorCallUseNew = true;
            }

            if (type === "map_entry_key") {
            } else if (isError) {
              subtypeDisplayed = subtypeDisplayedWhenCollapsed =
                value.constructor.name;
            } else if (subtype === "Object" || subtype === "Array") {
              // prefer {} over Object {}
              // and [] over Array []
              subtypeDisplayed = "";
              subtypeDisplayedWhenCollapsed = subtype;
            } else if (isFunctionPrototype) {
              // do not set subtypeDisplayed when function is displayed
              // ```
              // function Foo() {} {
              //   prototype: { name: "foo" }
              // }
              // ```
              // is better than
              // ```
              // function Foo() {} {
              //   prototype: Foo { name: "foo" }
              // }
              // ```
            } else {
              subtypeDisplayed = subtypeDisplayedWhenCollapsed = subtype;
            }

            if (isArray) {
              openDelimiter = "[";
              closeDelimiter = "]";
            } else {
              openDelimiter = "{";
              closeDelimiter = "}";
            }
          } else if (value === null) {
            subtype = "null";
          } else {
            subtype = typeof value;
            if (subtype === "string") {
              isString = true;
              if (type === "url_part") {
              } else if (type === "line") {
                canHaveChars = true;
                chars = splitChars(value);
                openDelimiter = `${index + 1} | `;
              } else if (type === "char") {
              } else {
                canHaveLines = true;
                lines = value.split(/\r?\n/);
                isMultiline = lines.length > 1;
                isErrorMessageString =
                  property === "message" && parent.parent.isError;
                if (isMultiline && !isErrorMessageString) {
                  useLineNumbersOnTheLeft = true;
                }
                if (isErrorMessageString) {
                  // no quote around error message (it is displayed in the "label diff")
                } else if (type === "property_key") {
                  if (isValidPropertyIdentifier(property)) {
                    // this property does not require quotes
                  } else {
                    useQuotes = true;
                    quote = DOUBLE_QUOTE;
                    openDelimiter = quote;
                    closeDelimiter = quote;
                  }
                } else if (isMultiline) {
                  // no quote around multiline
                } else {
                  useQuotes = true;
                  quote =
                    quoteOption === "auto"
                      ? pickBestQuote(value, { canUseTemplateString: true })
                      : quoteOption;
                  openDelimiter = quote;
                  closeDelimiter = quote;
                }
                if (canParseUrl(value)) {
                  isUrlString = true;
                  canHaveUrlParts = true;
                }
              }
            } else if (subtype === "symbol") {
              isSymbol = true;
              if (!wellKnownId) {
                symbolKey = Symbol.keyFor(value);
                if (symbolKey) {
                  subtypeDisplayed = subtypeDisplayedWhenCollapsed = [
                    "Symbol",
                    ".",
                    "for",
                  ];
                } else {
                  subtypeDisplayed = subtypeDisplayedWhenCollapsed = "Symbol";
                  symbolDescription = symbolToDescription(value);
                }
              }
            }
          }
        }

        if (type === "internal_value" && parent.isSet) {
          constructorCallOpenDelimiter = "";
          constructorCallCloseDelimiter = "";
          subtypeDisplayed = "";
          // prefer Set(2)
          // over Set(Array(2))
          subtypeDisplayedWhenCollapsed = "";
        }

        let depth;
        if (parent) {
          if (type === "property" || type === "map_entry") {
            depth = parent.depth;
          } else if (type === "internal_value") {
            if (displayedIn === "properties") {
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
          valueSeparator,
          valueEndSeparator,
          valueOf: () => {
            throw new Error(`use ${name}.value`);
          },
          isArrayIndex,
          property,
          descriptor,
          index,
          subtype,
          subtypeDisplayed,
          subtypeDisplayedWhenCollapsed,
          isComposite: composite,
          isPrimitive: primitive,
          isSourceCode,
          isString,
          isErrorMessageString,
          isMultiline,
          useLineNumbersOnTheLeft,
          useQuotes,
          canHaveLines,
          lines,
          canHaveChars,
          chars,
          canHaveUrlParts,
          isStringObject,
          isFunction,
          functionAnalysis,
          isFunctionPrototype,
          extendedClassName,
          isClassProperty,
          isClassPrototype,
          isArray,
          isSet,
          isUrl,
          isUrlString,
          isError,
          isMap,
          isSymbol,
          symbolKey,
          symbolDescription,
          canHaveProps,
          propsFrozen,
          propsSealed,
          propsExtensionsPrevented,
          canHaveIndexedValues,
          wellKnownId,
          constructorCall,
          constructorCallUseNew,
          constructorCallOpenDelimiter,
          constructorCallCloseDelimiter,
          openDelimiter,
          closeDelimiter,
          quote,
          displayedIn,
          hidden,
          showOnlyWhenDiff,
          reference,
          referenceFromOthersSet: new Set(),
        });
      }

      const childNodes = {
        prototype: null,
        internalValue: null,
        indexedPropertyMap: new Map(),
        namedPropertyMap: new Map(),
        symbolPropertyMap: new Map(),
        mapEntryMap: new Map(),
        key: null,
        value: null,
        get: null,
        set: null,
        enumerable: null,
        writable: null,
        configurable: null,
        lines: [],
        chars: [],
      };
      node.childNodes = childNodes;
      node.structureIsKnown = Boolean(node.wellKnownId || node.reference);

      const createPropertyLikeNode = (params) => {
        const propertyLikeNode = _createValueNode(params);
        const keyNode = _createValueNode({
          parent: propertyLikeNode,
          path: propertyLikeNode.path,
          type: "property_key",
          value: propertyLikeNode.property,
          property: propertyLikeNode.property,
          showOnlyWhenDiff: false,
        });
        propertyLikeNode.childNodes.key = keyNode;
        return propertyLikeNode;
      };

      prototype: {
        if (!node.isComposite || node.structureIsKnown) {
          break prototype;
        }
        const prototypeValue = Object.getPrototypeOf(node.value);
        if (shouldIgnorePrototype(node, prototypeValue)) {
          break prototype;
        }
        const prototypeNode = createPropertyLikeNode({
          parent: node,
          path: path.append("__proto__"),
          type: "prototype",
          property: "__proto__",
          valueSeparator: ":",
          value: prototypeValue,
          valueEndSeparator: ",",
          showOnlyWhenDiff: "deep",
        });
        childNodes.prototype = prototypeNode;
      }
      // internal value (.valueOf(), .href, .toString())
      internal_value: {
        if (node.structureIsKnown) {
          break internal_value;
        }
        if (node.isFunction) {
          const functionBody = createSourceCode(
            node.functionAnalysis.argsAndBodySource,
          );
          const internalValueNode = createPropertyLikeNode({
            parent: node,
            path: path.append("toString()"),
            type: "internal_value",
            value: functionBody,
            displayedIn:
              node.functionAnalysis.type === "class" ? "" : "subtype",
            property: "toString()",
            isSourceCode: true,
          });
          node.constructorCall = internalValueNode.displayedIn === "subtype";
          childNodes.internalValue = internalValueNode;
        } else if (node.isSet) {
          const setValues = [];
          for (const setValue of node.value) {
            setValues.push(setValue);
          }
          const setInternalValueNode = createPropertyLikeNode({
            parent: node,
            path: path.append("Symbol.iterator()"),
            type: "internal_value",
            value: setValues,
            displayedIn: "subtype",
            property: "Symbol.iterator()",
          });
          node.constructorCall = true;
          childNodes.internalValue = setInternalValueNode;
        } else if (node.isUrl) {
          const internalValue = node.href;
          const internalValueNode = createPropertyLikeNode({
            parent: node,
            path: path.append("href"),
            type: "internal_value",
            value: internalValue,
            displayedIn: "subtype",
            property: "href",
          });
          node.constructorCall = internalValueNode.displayedIn === "subtype";
          childNodes.internalValue = internalValueNode;
        } else if (node.isSymbol) {
          const { symbolDescription, symbolKey } = node;
          if (symbolDescription) {
            const symbolDescriptionNode = createPropertyLikeNode({
              parent: node,
              path: path.append("toString()"),
              type: "internal_value",
              value: symbolDescription,
              displayedIn: "subtype",
              property: "toString()",
            });
            node.constructorCall = true;
            childNodes.internalValue = symbolDescriptionNode;
          } else if (symbolKey) {
            const symbolKeyNode = createPropertyLikeNode({
              parent: node,
              path: path.append("keyFor()"),
              type: "internal_value",
              value: symbolKey,
              displayedIn: "subtype",
              property: "keyFor()",
            });
            node.constructorCall = true;
            childNodes.internalValue = symbolKeyNode;
          } else {
            node.constructorCall = true;
          }
        } else if (
          node.isComposite &&
          Symbol.toPrimitive in node.value &&
          typeof node.value[Symbol.toPrimitive] === "function"
        ) {
          const toPrimitiveReturnValue =
            node.value[Symbol.toPrimitive]("string");
          const internalValueNode = createPropertyLikeNode({
            parent: node,
            path: path.append("Symbol.toPrimitive()"),
            type: "internal_value",
            value: toPrimitiveReturnValue,
            displayedIn: "properties",
            property: "Symbol.toPrimitive()",
            valueSeparator: ":",
          });
          node.constructorCall = true;
          childNodes.internalValue = internalValueNode;
        } else if (
          node.isComposite &&
          "valueOf" in node.value &&
          typeof node.value.valueOf === "function" &&
          node.value.valueOf !== Object.prototype.valueOf
        ) {
          const valueOfReturnValue = node.value.valueOf();
          const displayedIn = // we display in constructor when a subtype is displayed
            // otherwise it's displayed as a prop
            node.subtype === "Object" || node.subtype === "Array"
              ? "properties"
              : "subtype";
          const internalValueNode = createPropertyLikeNode({
            parent: node,
            path: path.append("valueOf()"),
            type: "internal_value",
            value: valueOfReturnValue,
            displayedIn,
            property: "valueOf()",
            valueSeparator: ":",
            valueEndSeparator: displayedIn === "subtype" ? "" : ",",
          });
          node.constructorCall = internalValueNode.displayedIn === "subtype";
          childNodes.internalValue = internalValueNode;
        }
      }

      if (node.isMap) {
        const mapEntryMap = childNodes.mapEntryMap;
        const subtypeCounterMap = new Map();
        for (const [mapEntryKey, mapEntryValue] of node.value) {
          const mapEntryNode = _createValueNode({
            parent: node,
            path,
            type: "map_entry",
            value: null,
          });
          mapEntryMap.set(mapEntryKey, mapEntryNode);
          const mapEntryKeyNode = _createValueNode({
            parent: mapEntryNode,
            path: path.append("key", { isMeta: true }),
            type: "map_entry_key",
            value: mapEntryKey,
          });
          mapEntryNode.childNodes.key = mapEntryKeyNode;
          let pathPart = "";
          if (isComposite(mapEntryKey)) {
            const keySubtype = getSubtype(mapEntryKey);
            if (subtypeCounterMap.has(keySubtype)) {
              const subtypeCount = subtypeCounterMap.get(keySubtype) + 1;
              subtypeCounterMap.set(keySubtype, subtypeCount);
              pathPart = `${keySubtype}#${subtypeCount}`;
            } else {
              subtypeCounterMap.set(keySubtype, 1);
              pathPart = `${keySubtype}#1`;
            }
          } else {
            pathPart = String(mapEntryKey);
          }
          const mapEntryValueNode = _createValueNode({
            parent: mapEntryNode,
            path: path.append(pathPart),
            type: "map_entry_value",
            value: mapEntryValue,
            valueSeparator: "=>",
            valueEndSeparator: ",",
          });
          mapEntryNode.childNodes.value = mapEntryValueNode;
        }
      }

      // properties
      if (node.isComposite && !node.structureIsKnown) {
        const indexedPropertyMap = childNodes.indexedPropertyMap;
        const namedPropertyMap = childNodes.namedPropertyMap;
        const associatedValueMetaMap = new Map();

        // indexed properties
        if (node.isArray) {
          let index = 0;
          while (index < node.value.length) {
            if (node.parent && node.parent.isSet) {
              associatedValueMetaMap.set(String(index), {
                isSetValue: true,
                value: node.value[index],
              });
            } else {
              associatedValueMetaMap.set(String(index), {
                isArrayIndex: true,
                propertyDescriptor: Object.hasOwn(node.value, index)
                  ? Object.getOwnPropertyDescriptor(node.value, index)
                  : {
                      enumerable: true,
                      /* eslint-disable no-unneeded-ternary */
                      configurable:
                        node.propsFrozen || node.propsSealed ? false : true,
                      writable: node.propsFrozen ? false : true,
                      /* eslint-enable no-unneeded-ternary */
                      value: ARRAY_EMPTY_VALUE,
                    },
              });
            }
            index++;
          }
        } else if (node.isString || node.isStringObject) {
          let index = 0;
          // eslint-disable-next-line no-unused-vars
          while (index < node.value.length) {
            associatedValueMetaMap.set(String(index), {
              isStringIndex: true,
              propertyDescriptor: Object.getOwnPropertyDescriptor(
                node.value,
                index,
              ),
            });
            index++;
          }
        }
        // named properties
        const propertyNames = node.isString
          ? []
          : Object.getOwnPropertyNames(node.value);
        for (const propertyName of propertyNames) {
          if (associatedValueMetaMap.has(propertyName)) {
            continue;
          }
          const propertyDescriptor = Object.getOwnPropertyDescriptor(
            node.value,
            propertyName,
          );
          associatedValueMetaMap.set(propertyName, {
            propertyDescriptor,
          });
        }

        for (const [
          propertyName,
          {
            isSetValue,
            value,
            isArrayIndex,
            isStringIndex,
            propertyDescriptor,
          },
        ] of associatedValueMetaMap) {
          if (isSetValue) {
            const setValueNode = _createValueNode({
              parent: node,
              path: path.append(propertyName, { isArrayIndex: true }),
              type: "set_value",
              value,
              valueEndSeparator: ",",
            });
            indexedPropertyMap.set(propertyName, setValueNode);
            continue;
          }

          if (
            shouldIgnoreProperty(node, propertyName, {
              propertyDescriptor,
              isArrayIndex,
              isStringIndex,
            })
          ) {
            continue;
          }
          let displayedIn;
          let showOnlyWhenDiff = node.showOnlyWhenDiff === "deep" ? "deep" : "";
          if (propertyName === "name") {
            if (
              node.functionAnalysis.type === "classic" ||
              node.functionAnalysis.type === "class"
            ) {
              // function name or class name will be displayed in the "subtypeDiff"
              displayedIn = "subtype";
            }
          }
          if (propertyName === "message") {
            if (node.isError) {
              displayedIn = "subtype";
            }
          }
          if (!showOnlyWhenDiff) {
            if (propertyName === "prototype") {
              showOnlyWhenDiff = "deep";
            } else if (!propertyDescriptor.enumerable) {
              if (propertyName === "message" && node.isError) {
              } else {
                showOnlyWhenDiff = true;
              }
            }
          }

          const propertyNode = _createValueNode({
            parent: node,
            path: path.append(propertyName, { isArrayIndex }),
            type: "property",
            value: null,
            showOnlyWhenDiff,
            hidden,
            displayedIn,
            property: isArrayIndex ? null : propertyName,
            isClassProperty: node.functionAnalysis.type === "class",
            isClassPrototype:
              node.functionAnalysis.type === "class" &&
              propertyName === "prototype",
          });
          if (isArrayIndex) {
            indexedPropertyMap.set(propertyName, propertyNode);
          } else {
            namedPropertyMap.set(propertyName, propertyNode);
            const keyNode = _createValueNode({
              parent: propertyNode,
              path: propertyNode.path,
              type: "property_key",
              value: propertyName,
              showOnlyWhenDiff: false,
              property: propertyNode.property,
              isArrayIndex,
              isClassProperty: propertyNode.isClassProperty,
              isClassPrototype: propertyNode.isClassPrototype,
              displayedIn: propertyNode.displayedIn,
            });
            propertyNode.childNodes.key = keyNode;
          }

          const useAccessor = propertyDescriptor.get || propertyDescriptor.set;
          const toVisitWhenFrozen = useAccessor
            ? ["get", "set", "enumerable"]
            : ["value", "enumerable"];
          const toVisitWhenSealed = useAccessor
            ? ["get", "set", "enumerable", "writable"]
            : ["value", "enumerable", "writable"];
          const toVisitOtherwise = useAccessor
            ? ["get", "set", "enumerable", "configurable", "writable"]
            : ["value", "enumerable", "configurable", "writable"];
          const propertyDescriptorNames = node.propsFrozen
            ? toVisitWhenFrozen
            : node.propsSealed
              ? toVisitWhenSealed
              : toVisitOtherwise;
          for (const propertyDescriptorName of propertyDescriptorNames) {
            const propertyDescriptorValue =
              propertyDescriptor[propertyDescriptorName];
            if (
              shouldIgnorePropertyDescriptor(
                node,
                propertyName,
                propertyDescriptorName,
                propertyDescriptorValue,
              )
            ) {
              continue;
            }
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
              valueSeparator: propertyNode.isClassProperty
                ? "="
                : propertyDescriptorName === "get" ||
                    propertyDescriptorName === "set"
                  ? ""
                  : propertyNode.isArrayIndex &&
                      propertyDescriptorName === "value"
                    ? ""
                    : ":",
              valueEndSeparator:
                propertyNode.displayedIn === "subtype"
                  ? ""
                  : propertyNode.isClassPrototype
                    ? ""
                    : propertyNode.isClassProperty
                      ? ";"
                      : ",",
              property: propertyNode.property,
              isArrayIndex,
              descriptor: propertyDescriptorName,
              isClassProperty: propertyNode.isClassProperty,
              isClassPrototype: propertyNode.isClassPrototype,
              displayedIn: propertyNode.displayedIn,
              showOnlyWhenDiff: propertyDescriptorName !== "value",
            });
            propertyNode.childNodes[propertyDescriptorName] =
              propertyDescriptorNode;
          }
        }
      }
      // string (lines and chars)
      if (node.canHaveLines && !node.structureIsKnown) {
        const lineNodes = [];

        const lines = node.lines;
        for (const line of lines) {
          const lineNode = _createValueNode({
            parent: node,
            path: path.append(`#L${lineNodes.length + 1}`),
            type: "line",
            value: line,
            index: lineNodes.length,
          });
          lineNodes[lineNode.index] = lineNode;
        }

        childNodes.lines = lineNodes;
      }
      if (node.canHaveChars && !node.structureIsKnown) {
        const charNodes = [];

        const chars = node.chars;
        for (const char of chars) {
          const charNode = _createValueNode({
            parent: node,
            path: path.append(`C${charNodes.length + 1}`),
            type: "char",
            value: char,
            index: charNodes.length,
          });
          charNodes[charNode.index] = charNode;
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
            path: path.append(urlPartName),
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

let writeDiff;
{
  writeDiff = (comparison, context) => {
    if (comparison.hidden) {
      return "";
    }
    let node = comparison[context.resultType];
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
    const selfModified = context.modified || comparison.selfHasModification;
    const selfContext = { ...context };
    if (comparison.reasons.self.added.has("internal_value")) {
      selfContext.added = true;
      selfContext.removed = false;
      selfContext.modified = false;
    } else if (comparison.reasons.self.removed.has("internal_value")) {
      selfContext.added = false;
      selfContext.removed = false;
      selfContext.modified = true;
    } else if (selfModified) {
      selfContext.added = false;
      selfContext.removed = false;
      selfContext.modified = true;
    } else {
      selfContext.added = context.added || comparison.selfHasAddition;
      selfContext.removed = context.removed || comparison.selfHasRemoval;
      selfContext.modified = false;
    }

    const getNodeDisplayedProperty = (node) => {
      if (node.displayedIn === "subtype") {
        return "";
      }
      if (node.isClassPrototype) {
        return "";
      }
      if (node.functionAnalysis.type === "method") {
        return "";
      }
      if (node.isArrayIndex && node.descriptor === "value") {
        return "";
      }
      return node.property;
    };
    const getNodeValueEndSeparator = (node) => {
      if (node.isMultiline) {
        // when using
        // foo: 1| line 1
        //      2| line 2
        //      3| line 3
        // the "," separator is removed because it's not correctly separated from the multiline
        // and it becomes hard to know if "," is part of the string or not
        return "";
      }
      if (comparison === selfContext.startComparison) {
        return "";
      }
      return node.valueEndSeparator || "";
    };

    let diff = "";
    let displayValue = true;
    let isNestedValue = false;
    let property = getNodeDisplayedProperty(node);
    let valueSeparator = node.valueSeparator;
    let valueEndSeparator = getNodeValueEndSeparator(node);

    if (node.type === "property_key") {
      const maxColumns = selfContext.maxColumns;
      selfContext.maxColumns = Math.round(maxColumns * 0.5);
    } else if (node.type === "property_descriptor") {
      if (node.displayedIn !== "subtype") {
        isNestedValue = true;
      }
    } else if (node.type === "prototype") {
      isNestedValue = true;
    } else if (node.type === "internal_value") {
      if (node.displayedIn !== "subtype") {
        isNestedValue = true;
      }
    } else if (node.type === "set_value") {
      isNestedValue = true;
    } else if (node.type === "map_entry_key") {
      isNestedValue = true;
      const maxColumns = selfContext.maxColumns;
      selfContext.maxColumns = Math.round(maxColumns * 0.5);
    } else if (node.type === "map_entry_value") {
      isNestedValue = true;
    }

    if (isNestedValue) {
      if (context.collapsedWithOverview) {
        selfContext.collapsedWithOverview = false;
        selfContext.collapsed = true;
        valueEndSeparator = "";
      } else if (context.collapsed) {
        valueEndSeparator = "";
      } else {
        const relativeDepth = node.depth + selfContext.initialDepth;
        if (!node.isMultiline && relativeDepth >= selfContext.maxDepth) {
          selfContext.collapsedWithOverview = true;
        } else if (!comparison.hasAnyDiff) {
          selfContext.collapsedWithOverview = true;
        } else if (node.type === "map_entry_key") {
          selfContext.collapsedWithOverview = true;
        }

        if (node.type !== "map_entry_value") {
          let indent = `  `.repeat(relativeDepth);
          if (selfContext.signs) {
            if (selfContext.removed) {
              if (selfContext.resultType === "expectNode") {
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
                diff += ANSI.color(unexpectSign, unexpectSignColor);
                indent = indent.slice(1);
              }
            }
          }
          diff += indent;
        }
      }

      if (property && comparison !== selfContext.startComparison) {
        if (node.descriptor && node.descriptor !== "value") {
          const propertyPrefixColor = pickColor(
            comparison,
            selfContext,
            (node) => node.descriptor,
          );
          diff += ANSI.color(node.descriptor, propertyPrefixColor);
          diff += " ";
        }
        const keyComparison =
          node.type === "property_descriptor"
            ? node.parent.childNodes.key.comparison
            : node.childNodes.key.comparison;
        const keyContext = {
          ...selfContext,
          modified: context.modified,
        };
        const keyDiff = writeDiff(keyComparison, keyContext);
        diff += keyDiff;
        // if (
        //   selfContext.collapsedWithOverview &&
        //   !comparison.hasAnyDiff &&
        //   !context.modified &&
        //   !context.added &&
        //   !context.modified
        // ) {
        //   if (valueEndSeparator) {
        //     const valueEndSeparatorColor = pickColor(
        //       comparison,
        //       context,
        //       getNodeValueEndSeparator,
        //     );
        //     diff += ANSI.color(valueEndSeparator, valueEndSeparatorColor);
        //   }
        //   return diff;
        // }
      }
      if (
        (property ||
          node.type === "map_entry_value" ||
          node.type === "set_value") &&
        displayValue &&
        valueSeparator &&
        comparison !== selfContext.startComparison
      ) {
        const valueSeparatorColor = pickColor(
          comparison,
          selfContext,
          (node) => node.valueSeparator,
        );
        if (valueSeparator === "=" || valueSeparator === "=>") {
          diff += " ";
          diff += ANSI.color(valueSeparator, valueSeparatorColor);
          diff += " ";
        } else {
          diff += ANSI.color(valueSeparator, valueSeparatorColor);
          diff += " ";
        }
      }
    }

    selfContext.textIndent += stringWidth(diff);
    if (valueEndSeparator) {
      selfContext.maxColumns -= valueEndSeparator.length;
    }
    if (
      node.type !== "property" &&
      node.type !== "line" &&
      comparison.hasAnyDiff
    ) {
      selfContext.maxDepth = Math.min(
        node.depth + selfContext.maxDepthInsideDiff,
        selfContext.maxDepth,
      );
    }

    let displaySubtype = true;
    reference: {
      // referencing an other composite
      if (node.reference) {
        const refColor = pickColor(comparison, selfContext, (node) =>
          node.reference ? node.reference.path.toString() : null,
        );
        diff += ANSI.color(
          `<ref #${selfContext.getDisplayedId(node.reference.id)}>`,
          refColor,
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
        const refColor = pickColor(comparison, selfContext, (targetNode) => {
          if (targetNode === node) {
            return referenceFromOtherDisplayed.reference.path.toString();
          }
          return node.reference ? node.reference.path.toString() : null;
        });
        diff += ANSI.color(
          `<ref #${selfContext.getDisplayedId(
            referenceFromOtherDisplayed.reference.id,
          )}>`,
          refColor,
        );
        diff += " ";
      }
    }

    let subtypeDiff = "";
    if (displaySubtype) {
      subtypeDiff = writeLabelDiff(comparison, selfContext);
    }
    let valueDiff = "";
    value: {
      if (!displayValue) {
        break value;
      }
      if (node.wellKnownId) {
        const valueColor = getValueColor(comparison, selfContext);
        valueDiff += ANSI.color(node.wellKnownId, valueColor);
        break value;
      }
      if (node.isSourceCode) {
        const valueColor = getValueColor(comparison, selfContext);
        valueDiff += " ";
        valueDiff += ANSI.color("[source code]", valueColor);
        valueDiff += " ";
        break value;
      }
      // if (
      //   selfContext.collapsedWithOverview &&
      //   node.type === "property_descriptor" &&
      //   (node.descriptor === "get" || node.descriptor === "set")
      // ) {
      //   const propertyDescriptorNodes =
      //     node.parent.childNodes.propertyDescriptors;
      //   const getterNode = propertyDescriptorNodes.get;
      //   const setterNode = propertyDescriptorNodes.set;
      //   const hasGetter = getterNode && getterNode.value;
      //   const hasSetter = setterNode && setterNode.value;
      //   const valueColor = getValueColor(selfContext, comparison);
      //   if (hasGetter && hasSetter) {
      //     valueDiff += ANSI.color("[get/set]", valueColor);
      //     break value;
      //   }
      //   if (hasGetter) {
      //     valueDiff += ANSI.color("[get]", valueColor);
      //     break value;
      //   }
      //   valueDiff += ANSI.color("[set]", valueColor);
      //   break value;
      // }
      if (node.isPrimitive && !node.isUrlString) {
        if (node.canHaveLines) {
          valueDiff += writeLinesDiff(comparison, selfContext);
          break value;
        }
        if (node.type === "line") {
          valueDiff += writeOneLineDiff(comparison, selfContext);
          break value;
        }
        if (node.type === "char") {
          valueDiff += writeCharDiff(comparison, selfContext);
          break value;
        }
        if (node.isSymbol) {
          // already in subtype
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
        const valueColor = getValueColor(comparison, selfContext);
        valueDiff += ANSI.color(valueDiffRaw, valueColor);
        break value;
      }
      if (selfContext.collapsed) {
        break value;
      }
      if (node.type === "property") {
        const propertyDescriptorComparisons = comparison.childComparisons;
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
        for (const propertyDescriptorName of [
          "value",
          "get",
          "set",
          "enumerable",
          "configurable",
          "writable",
        ]) {
          const propertyDescriptorComparison =
            propertyDescriptorComparisons[propertyDescriptorName];
          if (propertyDescriptorComparison === null) {
            continue;
          }
          const propertyDescriptorNode =
            propertyDescriptorComparison[context.resultType];
          if (!propertyDescriptorNode) {
            continue;
          }
          let propertyDescriptorDiff = "";

          propertyDescriptorDiff += writeDiff(
            propertyDescriptorComparison,
            selfContext,
          );
          if (propertyDescriptorDiff.trim()) {
            if (propertyDiff) {
              propertyDiff += "\n";
              selfContext.textIndent = 0;
            }
            propertyDiff += propertyDescriptorDiff;
          }
        }
        valueDiff += propertyDiff;
        break value;
      }
      if (node.type === "map_entry") {
        let mapEntryDiff = "";
        const mapEntryKeyDiff = writeDiff(
          node.childNodes.key.comparison,
          selfContext,
        );
        mapEntryDiff += mapEntryKeyDiff;
        const mapEntryValueDiff = writeDiff(
          node.childNodes.value.comparison,
          selfContext,
        );
        mapEntryDiff += mapEntryValueDiff;
        return mapEntryDiff;
      }

      const actualNodeWhoCanHaveIndexedValues = pickSelfOrInternalNode(
        comparison.actualNode,
        (node) => node.canHaveIndexedValues,
      );
      const expectNodeWhoCanHaveIndexedValues = pickSelfOrInternalNode(
        comparison.expectNode,
        (node) => node.canHaveIndexedValues,
      );
      const canResetModifiedOnIndexedValue = Boolean(
        actualNodeWhoCanHaveIndexedValues && expectNodeWhoCanHaveIndexedValues,
      );
      const actualNodeWhoCanHaveProps = pickSelfOrInternalNode(
        comparison.actualNode,
        (node) => node.canHaveProps,
      );
      const expectNodeWhoCanHaveProps = pickSelfOrInternalNode(
        comparison.expectNode,
        (node) => node.canHaveProps,
      );
      const canResetModifiedOnProperty = Boolean(
        actualNodeWhoCanHaveProps && expectNodeWhoCanHaveProps,
      );
      const canResetModifiedOnMapEntry = canResetModifiedOnProperty;

      if (selfContext.collapsedWithOverview) {
        const valueColor = getValueColor(comparison, selfContext);
        const openDelimiter = node.openDelimiter;
        const closeDelimiter = node.closeDelimiter;
        const nestedValueSeparator = node.canHaveProps ? "," : "";
        const nestedValueSpacing = node.canHaveProps && !node.isArray;
        const ellipsis = "...";

        let subtypeDiffCollapsed = writeLabelDiff(comparison, {
          ...selfContext,
          collapsedWithOverview: false,
          collapsed: true,
        });
        if (subtypeDiffCollapsed) {
          subtypeDiffCollapsed += " ";
        }
        const estimatedCollapsedBoilerplate = `${subtypeDiffCollapsed}${openDelimiter}${nestedValueSeparator} ${ellipsis} ${closeDelimiter}`;
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
        const nestedComparisons = node.canHaveIndexedValues
          ? createIndexedPropertyComparisonIterable(node)
          : node.isMap
            ? createMapEntryComparisonIterable(node)
            : createNamedPropertyComparisonIterable(node);
        for (const nestedComparison of nestedComparisons) {
          if (nestedComparison.hidden) {
            continue;
          }
          const nestedNode = nestedComparison[context.resultType];
          if (nestedNode.displayedIn === "subtype") {
            continue;
          }
          // TODO: we should respect maxValueInsideDiff here too
          let valueDiffOverview = "";
          const nestedValueContext = {
            ...selfContext,
            modified:
              nestedNode.type === "property"
                ? nestedNode.isIndex
                  ? canResetModifiedOnIndexedValue
                    ? false
                    : selfContext.modified
                  : canResetModifiedOnProperty
                    ? false
                    : selfContext.modified
                : nestedNode.type === "map_entry" && canResetModifiedOnMapEntry
                  ? false
                  : selfContext.modified,
          };
          const markersColor = pickColor(nestedComparison, nestedValueContext);
          valueDiffOverview += writeDiff(nestedComparison, nestedValueContext);
          const valueWidth = stringWidth(valueDiffOverview);
          if (width + valueWidth > remainingWidth) {
            let overviewTruncated = "";
            overviewTruncated += subtypeDiffCollapsed;
            overviewTruncated += ANSI.color(openDelimiter, markersColor);
            if (insideOverview) {
              if (nestedValueSpacing) {
                overviewTruncated += " ";
              }
              overviewTruncated += insideOverview;
              if (nestedValueSeparator) {
                overviewTruncated += ANSI.color(
                  nestedValueSeparator,
                  markersColor,
                );
              }
            }
            if (nestedValueSpacing) {
              overviewTruncated += " ";
            }
            overviewTruncated += ANSI.color(ellipsis, valueColor);
            if (nestedValueSpacing) {
              overviewTruncated += " ";
            }
            overviewTruncated += ANSI.color(closeDelimiter, markersColor);
            valueDiff += overviewTruncated;
            break value;
          }
          if (nestedValueSeparator) {
            if (isFirst) {
              isFirst = false;
            } else {
              insideOverview += ANSI.color(nestedValueSeparator, markersColor);
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
        const shouldDisplayDelimiters = node.isClassPrototype
          ? false
          : subtypeDiff
            ? insideOverview.length > 0
            : true;
        if (shouldDisplayDelimiters) {
          const delimitersColor = pickDelimitersColor(comparison, selfContext);

          let insideOverviewDiff = "";
          insideOverviewDiff += ANSI.color(openDelimiter, delimitersColor);
          if (insideOverview) {
            if (nestedValueSpacing) {
              insideOverviewDiff += " ";
              insideOverviewDiff += insideOverview;
              insideOverviewDiff += " ";
            } else {
              insideOverviewDiff += insideOverview;
            }
          }
          insideOverviewDiff += ANSI.color(closeDelimiter, delimitersColor);
          valueDiff += insideOverviewDiff;
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
      const writeNestedValueGroupDiff = ({
        label,
        openDelimiter,
        closeDelimiter,
        forceDelimitersWhenEmpty,
        resetModified,
        nestedComparisons,
      }) => {
        let groupDiff = "";
        const entryBeforeDiffArray = [];
        let skippedArray = [];
        const maxDiff =
          selfContext.modified || selfContext.added || selfContext.removed
            ? selfContext.maxValueInsideDiff
            : selfContext.maxDiffPerObject;
        for (const nestedComparison of nestedComparisons) {
          if (nestedComparison.hidden) {
            continue;
          }
          const nestedNode = nestedComparison[context.resultType];
          if (nestedNode.displayedIn === "subtype") {
            continue;
          }
          if (!nestedComparison.hasAnyDiff) {
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
              aboveSummary += `${skipped} ${label}s`;
              groupDiff += `${indent}  `;
              const arrowSign = diffCount > 1 ? `↕` : `↑`;
              groupDiff += ANSI.color(
                `${arrowSign} ${aboveSummary} ${arrowSign}`,
                pickColor(comparison, selfContext),
              );
              groupDiff += "\n";
            }
            groupDiff += beforeDiff;
            skippedArray.length = 0;
          }
          const nestedValueDiff = writeNestedValueDiff(nestedComparison, {
            resetModified,
          });
          groupDiff += nestedValueDiff;
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
            if (nextComparison.hasAnyDiff) {
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
          if (selfContext.added) {
            skippedCounters.total = skippedCounters.added = skippedArray.length;
          } else if (selfContext.removed) {
            skippedCounters.total = skippedCounters.removed =
              skippedArray.length;
          } else if (selfContext.modified) {
            skippedCounters.total = skippedCounters.modified =
              skippedArray.length;
          } else {
            for (const skippedComparison of skippedArray) {
              skippedCounters.total++;
              if (skippedComparison.selfHasAddition) {
                selfContext.onComparisonDisplayed(skippedComparison, true);
                skippedCounters.added++;
                continue;
              }
              if (skippedComparison.selfHasRemoval) {
                selfContext.onComparisonDisplayed(skippedComparison, true);
                skippedCounters.removed++;
                continue;
              }
              if (selfContext.modified || skippedComparison.hasAnyDiff) {
                selfContext.onComparisonDisplayed(skippedComparison, true);
                skippedCounters.modified++;
                continue;
              }
              continue;
            }
          }
          let markersColor;
          let summaryColor;
          let summaryDetails = [];

          if (skippedCounters.removed === skippedCounters.total) {
            markersColor = summaryColor = removedColor;
          } else if (skippedCounters.added === skippedCounters.total) {
            markersColor = summaryColor = addedColor;
          } else if (skippedCounters.modified === skippedCounters.total) {
            markersColor = summaryColor = selfContext.resultColor;
          } else {
            markersColor = pickColor(comparison, selfContext);
            summaryColor = markersColor;
            if (skippedCounters.removed) {
              summaryDetails.push(
                ANSI.color(`${skippedCounters.removed} removed`, removedColor),
              );
            }
            if (skippedCounters.added) {
              summaryDetails.push(
                ANSI.color(`${skippedCounters.added} added`, addedColor),
              );
            }
            if (skippedCounters.modified) {
              summaryDetails.push(
                ANSI.color(
                  `${skippedCounters.modified} modified`,
                  selfContext.resultColor,
                ),
              );
            }
          }
          groupDiff += `${indent}  `;
          groupDiff += ANSI.color(`↓`, markersColor);
          groupDiff += " ";
          groupDiff += ANSI.color(
            skippedCounters.total === 1
              ? `${skippedCounters.total} ${label}`
              : `${skippedCounters.total} ${label}s`,
            summaryColor,
          );
          if (summaryDetails.length) {
            groupDiff += ` `;
            groupDiff += ANSI.color(`(`, markersColor);
            groupDiff += summaryDetails.join(" ");
            groupDiff += ANSI.color(`)`, markersColor);
          }
          groupDiff += " ";
          groupDiff += ANSI.color(`↓`, markersColor);
          groupDiff += "\n";
        }
        if (selfContext.signs) {
          if (selfContext.resultType === "actualNode") {
            if (context.added) {
              groupDiff += ANSI.color(addedSign, addedSignColor);
              indent = indent.slice(1);
            } else if (context.modified) {
              groupDiff += ANSI.color(unexpectSign, unexpectSignColor);
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
        if (groupDiff.length > 0 || forceDelimitersWhenEmpty) {
          let groupDiff2 = "";
          const delimitersColor = pickDelimitersColor(comparison, selfContext);
          groupDiff2 += ANSI.color(openDelimiter, delimitersColor);
          groupDiff2 += groupDiff;
          groupDiff2 += ANSI.color(closeDelimiter, delimitersColor);
          return groupDiff2;
        }
        return groupDiff;
      };

      let insideDiff = "";
      if (node.canHaveIndexedValues) {
        const indexedPropsComparisons =
          createIndexedPropertyComparisonIterable(node);
        const indexedValuesDiff = writeNestedValueGroupDiff({
          label: "value",
          openDelimiter: "[",
          closeDelimiter: "]",
          forceDelimitersWhenEmpty: true,
          resetModified: canResetModifiedOnIndexedValue,
          nestedComparisons: indexedPropsComparisons,
        });
        insideDiff += indexedValuesDiff;
      } else if (node.isMap) {
        const mapEntryComparisons = createMapEntryComparisonIterable(node);
        const mapEntriesDiff = writeNestedValueGroupDiff({
          label: "value",
          openDelimiter: "{",
          closeDelimiter: "}",
          forceDelimitersWhenEmpty: true,
          resetModified: canResetModifiedOnMapEntry,
          nestedComparisons: mapEntryComparisons,
        });
        insideDiff += mapEntriesDiff;
      }
      if (node.canHaveProps) {
        const namedPropsComparisons =
          createNamedPropertyComparisonIterable(node);
        const forceDelimitersWhenEmpty =
          (!node.canHaveIndexedValues &&
            !node.isMap &&
            subtypeDiff.length === 0 &&
            node.functionAnalysis.type === undefined) ||
          node.functionAnalysis.type === "class";
        let namedValuesDiff = writeNestedValueGroupDiff({
          label: "prop",
          openDelimiter: "{",
          closeDelimiter: "}",
          forceDelimitersWhenEmpty,
          resetModified: canResetModifiedOnProperty,
          nestedComparisons: namedPropsComparisons,
        });
        if (namedValuesDiff) {
          if (insideDiff) {
            insideDiff += " ";
          }
          insideDiff += namedValuesDiff;
        }
      }
      valueDiff += insideDiff;
      break value;
    }

    const spaceBetweenLabelAndValue =
      subtypeDiff &&
      valueDiff &&
      !node.isSet &&
      node.functionAnalysis.type !== "class";
    if (node.propsFrozen || node.propsSealed || node.propsExtensionsPrevented) {
      const objectMethodCallColor = pickColor(
        comparison,
        selfContext,
        (node) =>
          node.propsFrozen || node.propsSealed || node.propsExtensionsPrevented,
        {
          preferSolorColor: true,
        },
      );
      let methodName;
      let propertyForThatMethod;
      if (node.propsFrozen) {
        methodName = "freeze";
        propertyForThatMethod = "propsFrozen";
      } else if (node.propsSealed) {
        methodName = "seal";
        propertyForThatMethod = "propsSealed";
      } else {
        methodName = "preventExtensions";
        propertyForThatMethod = "propsExtensionsPrevented";
      }
      const objectMethodColor = pickColor(
        comparison,
        selfContext,
        (node) => node[propertyForThatMethod],
        {
          preferSolorColor: objectMethodCallColor !== sameColor,
        },
      );
      diff += ANSI.color(`Object.`, objectMethodCallColor);
      diff += ANSI.color(methodName, objectMethodColor);
      diff += ANSI.color(`(`, objectMethodCallColor);
      diff += subtypeDiff;
      if (spaceBetweenLabelAndValue) {
        diff += " ";
      }
      diff += valueDiff;
      diff += ANSI.color(")", objectMethodCallColor);
    } else {
      diff += subtypeDiff;
      if (spaceBetweenLabelAndValue) {
        diff += " ";
      }
      diff += valueDiff;
    }
    if (valueEndSeparator) {
      const valueEndSeparatorColor = pickColor(
        comparison,
        context,
        getNodeValueEndSeparator,
      );
      diff += ANSI.color(valueEndSeparator, valueEndSeparatorColor);
    }
    return diff;
  };

  const writeLabelDiff = (comparison, context) => {
    let labelDiff = "";
    const node = comparison[context.resultType];
    if (node.isFunction) {
      labelDiff += writeFunctionLabelDiff(comparison, context);
    } else {
      if (node.constructorCall) {
        if (node.constructorCallUseNew) {
          const constructorCallNewColor = pickColor(
            comparison,
            context,
            (node) =>
              node.constructorCall ? node.constructorCallUseNew : false,
          );
          labelDiff += ANSI.color(`new`, constructorCallNewColor);
          labelDiff += " ";
        }
      }
      let subtypeDisplayed = context.collapsed
        ? node.subtypeDisplayedWhenCollapsed
        : node.subtypeDisplayed;
      if (subtypeDisplayed === undefined) {
        return "";
      }
      if (subtypeDisplayed) {
        subtypeDisplayed = Array.isArray(subtypeDisplayed)
          ? subtypeDisplayed
          : [subtypeDisplayed];
        const otherNode = comparison[context.otherResultType];
        let otherNodeSubtypeDisplayed = otherNode
          ? context.collapsed
            ? otherNode.subtypeDisplayedWhenCollapsed
            : otherNode.subtypeDisplayed
          : null;
        otherNodeSubtypeDisplayed = Array.isArray(otherNodeSubtypeDisplayed)
          ? otherNodeSubtypeDisplayed
          : [otherNodeSubtypeDisplayed];
        let index = 0;
        while (index < subtypeDisplayed.length) {
          const part = subtypeDisplayed[index];
          const otherPart = otherNodeSubtypeDisplayed[index];
          const partColor = pickColor(
            comparison,
            context,
            (targetNode) => {
              return targetNode === node ? part : otherPart;
            },
            {
              preferSolorColor: index > 0,
            },
          );
          labelDiff += ANSI.color(part, partColor);
          index++;
        }
      }
    }

    const constructorCallDelimitersColor = pickColor(
      comparison,
      context,
      (node) => (node.constructorCall ? node.constructorCallOpenDelimiter : ""),
    );
    if (node.isError) {
      const messagePropertyNode =
        node.childNodes.namedPropertyMap.get("message");
      if (messagePropertyNode) {
        const errorMessageSeparatorColor = pickColor(
          comparison,
          context,
          (node) =>
            node.isError && node.childNodes.namedPropertyMap.has("message"),
        );
        labelDiff += ANSI.color(":", errorMessageSeparatorColor);
        labelDiff += " ";
        const messagePropertyComparison = messagePropertyNode.comparison;
        labelDiff += writeDiff(messagePropertyComparison, context);
      }
    } else if (node.constructorCall) {
      const internalValueNode = node.childNodes.internalValue;
      let internalValueDiff = "";
      if (internalValueNode) {
        const internalValueComparison = internalValueNode.comparison;
        // const actualCanHaveInternalValue = Boolean(
        //   internalValueComparison.actualNode &&
        //     internalValueComparison.actualNode.type === "internal_value",
        // );
        // const expectCanHaveInternalValue = Boolean(
        //   internalValueComparison.expectNode &&
        //     internalValueComparison.expectNode.type === "internal_value",
        // );
        // const canResetModifiedOnInternalValue =
        //   actualCanHaveInternalValue && expectCanHaveInternalValue;
        internalValueDiff = writeDiff(internalValueComparison, {
          ...context,
          modified: false,
        });
      }
      if (node.constructorCallOpenDelimiter) {
        labelDiff += ANSI.color(
          node.constructorCallOpenDelimiter,
          constructorCallDelimitersColor,
        );
        labelDiff += internalValueDiff;
        labelDiff += ANSI.color(
          node.constructorCallCloseDelimiter,
          constructorCallDelimitersColor,
        );
      } else {
        labelDiff += internalValueDiff;
      }
    }

    const shouldDisplayNestedValueCount =
      context.collapsed && node.type !== "map_entry_key";
    if (!shouldDisplayNestedValueCount) {
      return labelDiff;
    }
    if (node.canHaveIndexedValues) {
      const indexedPropertySize = node.childNodes.indexedPropertyMap.size;
      const sizeColor = pickColorAccordingToChild(comparison, context, (node) =>
        node.childNodes.indexedPropertyMap.values(),
      );
      const indexedPropertySizeDiff = ANSI.color(
        indexedPropertySize,
        sizeColor,
      );
      if (node.constructorCallOpenDelimiter) {
        labelDiff += ANSI.color(
          node.constructorCallOpenDelimiter,
          constructorCallDelimitersColor,
        );
        labelDiff += indexedPropertySizeDiff;
        labelDiff += ANSI.color(
          node.constructorCallCloseDelimiter,
          constructorCallDelimitersColor,
        );
      } else {
        labelDiff += indexedPropertySizeDiff;
      }
      const namedPropertySize = node.childNodes.namedPropertyMap.size;
      if (namedPropertySize) {
        const delimitersColor = pickDelimitersColor(comparison, context);
        const namedPropertySizeColor = pickColorAccordingToChild(
          comparison,
          context,
          (node) => node.childNodes.namedPropertyMap.values(),
        );
        labelDiff += " ";
        labelDiff += ANSI.color("{", delimitersColor);
        labelDiff += ANSI.color(namedPropertySize, namedPropertySizeColor);
        labelDiff += ANSI.color("}", delimitersColor);
      }
      return labelDiff;
    }
    if (node.isMap) {
      const mapSizeColor = pickColorAccordingToChild(
        comparison,
        context,
        (node) => node.childNodes.mapEntryMap.values(),
      );
      labelDiff += ANSI.color("(", constructorCallDelimitersColor);
      labelDiff += ANSI.color(node.value.size, mapSizeColor);
      labelDiff += ANSI.color(")", constructorCallDelimitersColor);
      const namedPropertySize = node.childNodes.namedPropertyMap.size;
      if (namedPropertySize) {
        const delimitersColor = pickDelimitersColor(comparison, context);
        const namedPropertySizeColor = pickColorAccordingToChild(
          comparison,
          context,
          (node) => node.childNodes.namedPropertyMap.values(),
        );
        labelDiff += " ";
        labelDiff += ANSI.color("{", delimitersColor);
        labelDiff += ANSI.color(namedPropertySize, namedPropertySizeColor);
        labelDiff += ANSI.color("}", delimitersColor);
      }
      return labelDiff;
    }
    if (node.isString) {
      const stringLengthColor = pickColorAccordingToChild(
        comparison,
        context,
        (node) => node.childNodes.lines,
      );
      labelDiff += ANSI.color("(", constructorCallDelimitersColor);
      labelDiff += ANSI.color(node.value.length, stringLengthColor);
      labelDiff += ANSI.color(")", constructorCallDelimitersColor);
      return labelDiff;
    }
    if (node.canHaveProps) {
      const namedPropertySize = node.childNodes.namedPropertyMap.size;
      const namedPropertySizeColor = pickColorAccordingToChild(
        comparison,
        context,
        (node) => node.childNodes.namedPropertyMap.values(),
      );
      if (node.constructorCall) {
        if (namedPropertySize) {
          labelDiff += " ";
          labelDiff += ANSI.color("{", constructorCallDelimitersColor);
          labelDiff += ANSI.color(namedPropertySize, namedPropertySizeColor);
          labelDiff += ANSI.color("}", constructorCallDelimitersColor);
        }
      } else {
        labelDiff += ANSI.color("(", constructorCallDelimitersColor);
        labelDiff += ANSI.color(namedPropertySize, namedPropertySizeColor);
        labelDiff += ANSI.color(")", constructorCallDelimitersColor);
      }
    }
    return labelDiff;
  };
  const writeFunctionLabelDiff = (comparison, context) => {
    let functionLabelDiff = "";
    const node = comparison[context.resultType];
    const prototypeComparison = comparison.childComparisons.prototype;
    if (prototypeComparison) {
      context.onComparisonDisplayed(prototypeComparison, true);
    }
    if (node.functionAnalysis.type === "class") {
      // the class .toString() is not displayed because it contains the whole
      // class definition which is actually rendered differently
      const internalValueComparison = comparison.childComparisons.internalValue;
      if (internalValueComparison) {
        context.onComparisonDisplayed(internalValueComparison, true);
      }
    }
    if (node.isClassProperty) {
      const staticColor = pickColor(
        comparison,
        context,
        (node) => node.isClassProperty,
      );
      functionLabelDiff += ANSI.color("static", staticColor);
    }
    if (node.wellKnownId) {
      return "";
    }
    if (node.functionAnalysis.type === "class") {
      const classKeywordColor = pickColor(
        comparison,
        context,
        (node) => node.functionAnalysis.type === "class",
      );
      if (functionLabelDiff) {
        functionLabelDiff += " ";
      }
      functionLabelDiff += ANSI.color("class", classKeywordColor);
    }
    if (node.functionAnalysis.isAsync) {
      const asyncKeywordColor = pickColor(
        comparison,
        context,
        (node) => node.functionAnalysis.isAsync,
      );
      functionLabelDiff += ANSI.color("async", asyncKeywordColor);
    }
    if (node.functionAnalysis.type === "classic") {
      const getFunctionLabel = (node) => {
        if (node.functionAnalysis.type === "classic") {
          if (node.functionAnalysis.isGenerator) {
            return "function*";
          }
          return "function";
        }
        return "other";
      };
      const functionLabelColor = pickColor(
        comparison,
        context,
        getFunctionLabel,
      );
      if (functionLabelDiff) {
        functionLabelDiff += " ";
      }
      functionLabelDiff += ANSI.color(
        getFunctionLabel(node),
        functionLabelColor,
      );
    }
    if (node.functionAnalysis.name) {
      const functionNameColor = pickColor(
        comparison,
        {
          ...context,
          modified: true,
        },
        (node) => node.functionAnalysis.name,
      );
      if (functionLabelDiff) {
        functionLabelDiff += " ";
      }
      functionLabelDiff += ANSI.color(node.value.name, functionNameColor);
      // consider the function.name as displayed
      // context.onComparisonDisplayed(functionNameComparison, true);
    }
    const extendedClassName = node.extendedClassName;
    if (extendedClassName) {
      const extendsKeywordColor = pickColor(comparison, context, (node) =>
        Boolean(node.extendedClassName),
      );
      functionLabelDiff += " ";
      functionLabelDiff += ANSI.color("extends", extendsKeywordColor);
      functionLabelDiff += " ";
      const extendedClassNameColor = pickColor(
        comparison,
        context,
        (node) => node.extendedClassName,
      );
      functionLabelDiff += ANSI.color(
        node.extendedClassName,
        extendedClassNameColor,
      );
    }
    const beforeFunctionBodyColor = pickColor(comparison, context, (node) =>
      node.functionAnalysis.type === "arrow"
        ? "() => "
        : node.functionAnalysis.getterName ||
            node.functionAnalysis.setterName ||
            node.isFunction
          ? "()"
          : "",
    );
    if (node.functionAnalysis.type === "arrow") {
      if (functionLabelDiff) {
        functionLabelDiff += " ";
      }
      functionLabelDiff += ANSI.color("() =>", beforeFunctionBodyColor);
      functionLabelDiff += " ";
    } else if (node.functionAnalysis.type === "method") {
      if (functionLabelDiff) {
        functionLabelDiff += " ";
      }
      if (node.functionAnalysis.getterName) {
        functionLabelDiff += ANSI.color("get", beforeFunctionBodyColor);
        functionLabelDiff += " ";
        functionLabelDiff += ANSI.color(node.property, beforeFunctionBodyColor);
        functionLabelDiff += ANSI.color("()", beforeFunctionBodyColor);
        functionLabelDiff += " ";
      } else if (node.functionAnalysis.setterName) {
        functionLabelDiff += ANSI.color("set", beforeFunctionBodyColor);
        functionLabelDiff += " ";
        functionLabelDiff += ANSI.color(node.property, beforeFunctionBodyColor);
        functionLabelDiff += ANSI.color("()", beforeFunctionBodyColor);
        functionLabelDiff += " ";
      } else {
        functionLabelDiff += ANSI.color(node.property, beforeFunctionBodyColor);
        functionLabelDiff += ANSI.color("()", beforeFunctionBodyColor);
        functionLabelDiff += " ";
      }
    } else if (node.functionAnalysis.type === "classic") {
      if (functionLabelDiff) {
        functionLabelDiff += " ";
      }
      functionLabelDiff += ANSI.color("()", beforeFunctionBodyColor);
      functionLabelDiff += " ";
    } else if (functionLabelDiff) {
      functionLabelDiff += " ";
    }
    return functionLabelDiff;
  };

  const writeLinesDiff = (comparison, context) => {
    const stringNode = comparison[context.resultType];
    const lineNodes = stringNode.childNodes.lines;
    const lineComparisons = comparison.childComparisons.lines;
    // single line string (both actual and expect)
    const isSingleLine = lineComparisons.length === 1;
    const actualSelfOrInternalNode = pickSelfOrInternalNode(
      comparison.actualNode,
      (node) => node.canHaveLines,
    );
    const expectSelfOrInternalNode = pickSelfOrInternalNode(
      comparison.expectNode,
      (node) => node.canHaveLines,
    );
    const resetModified =
      actualSelfOrInternalNode &&
      actualSelfOrInternalNode.canHaveLines &&
      expectSelfOrInternalNode &&
      expectSelfOrInternalNode.canHaveLines;
    const stringContext = {
      ...context,
      modified: resetModified ? false : context.modified,
      quotes: stringNode.useQuotes ? stringNode.quote : null,
      useLineNumbersOnTheLeft: stringNode.useLineNumbersOnTheLeft,
      biggestLineIndex: undefined,
      focusedCharIndex: undefined,
    };

    single_line: {
      if (!isSingleLine) {
        break single_line;
      }
      const firstLineComparison = lineComparisons[0];
      stringContext.focusedCharIndex = getFocusedCharIndex(
        firstLineComparison,
        stringContext,
      );
      return writeDiff(firstLineComparison, stringContext);
    }
    multiline: {
      let focusedLineIndex = lineNodes.findIndex((lineNode) => {
        return lineNode.comparison.hasAnyDiff;
      });
      if (focusedLineIndex === -1) {
        focusedLineIndex = lineNodes.length - 1;
      }
      const focusedLineComparison = lineComparisons[focusedLineIndex];
      stringContext.focusedCharIndex = getFocusedCharIndex(
        focusedLineComparison,
        context,
      );
      stringContext.biggestLineIndex = focusedLineIndex;

      if (context.collapsed || context.collapsedWithOverview) {
        let focusedLineDiff = writeDiff(focusedLineComparison, {
          ...stringContext,
          overflowLeft: focusedLineIndex > 0,
          overflowRight: lineNodes.length - 1 - focusedLineIndex > 0,
        });
        return focusedLineDiff;
      }

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
        lineBeforeArray.push(lineComparisons[0]);
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
        if (nextLineIndex > focusedLineIndex) {
          stringContext.biggestLineIndex = nextLineIndex;
        }
      }
      let nextLineRemaining =
        lineNodes.length - 1 - focusedLineIndex - lineAfterArray.length;
      if (nextLineRemaining === 1) {
        lineAfterArray.push(lineComparisons[lineComparisons.length - 1]);
        nextLineRemaining = 0;
      }

      const diffLines = [];
      if (previousLineRemaining) {
        let previousLinesSkippedDiff = "";
        previousLinesSkippedDiff += " ".repeat(
          String(stringContext.biggestLineIndex + 1).length,
        );
        previousLinesSkippedDiff += ANSI.color(
          `↑ ${previousLineRemaining} lines ↑`,
          sameColor,
        );
        diffLines.push(previousLinesSkippedDiff);
      }
      for (const lineBefore of lineBeforeArray) {
        diffLines.push(writeDiff(lineBefore, stringContext));
      }
      diffLines.push(writeDiff(focusedLineComparison, stringContext));
      for (const lineAfter of lineAfterArray) {
        diffLines.push(writeDiff(lineAfter, stringContext));
      }
      if (nextLineRemaining) {
        const skippedCounters = {
          total: 0,
          modified: 0,
          added: 0,
          removed: 0,
        };
        const from = focusedLineIndex + lineAfterArray.length + 1;
        const to = lineNodes.length;
        let index = from;
        while (index < to) {
          const nextLineComparison = lineComparisons[index];
          index++;
          skippedCounters.total++;
          if (stringContext.modified) {
            context.onComparisonDisplayed(nextLineComparison, true);
            skippedCounters.modified++;
          } else if (nextLineComparison.selfHasAddition) {
            context.onComparisonDisplayed(nextLineComparison, true);
            skippedCounters.added++;
          } else if (nextLineComparison.selfHasRemoval) {
            context.onComparisonDisplayed(nextLineComparison, true);
            skippedCounters.removed++;
          } else if (nextLineComparison.hasAnyDiff) {
            context.onComparisonDisplayed(nextLineComparison, true);
            skippedCounters.modified++;
          }
        }

        let markersColor;
        let summaryColor;
        let summaryDetails = [];
        if (skippedCounters.removed === skippedCounters.total) {
          summaryColor = removedColor;
          markersColor = removedColor;
        } else if (skippedCounters.added === skippedCounters.total) {
          summaryColor = addedColor;
          markersColor = addedColor;
        } else {
          markersColor = pickColor(comparison, context);
          summaryColor = pickColor(comparison, context);
          if (skippedCounters.removed) {
            summaryDetails.push(
              ANSI.color(`${skippedCounters.removed} removed`, removedColor),
            );
          }
          if (skippedCounters.added) {
            summaryDetails.push(
              ANSI.color(`${skippedCounters.added} added`, addedColor),
            );
          }
          if (skippedCounters.modified) {
            summaryDetails.push(
              ANSI.color(
                `${skippedCounters.modified} modified`,
                context.resultColor,
              ),
            );
          }
        }

        let nextLinesSkippedDiff = "";
        nextLinesSkippedDiff += " ".repeat(
          String(stringContext.biggestLineIndex + 1).length,
        );
        nextLinesSkippedDiff += ANSI.color("↓", markersColor);
        nextLinesSkippedDiff += " ";
        nextLinesSkippedDiff += ANSI.color(
          `${skippedCounters.total} lines`,
          summaryColor,
        );
        if (summaryDetails.length) {
          nextLinesSkippedDiff += ` `;
          nextLinesSkippedDiff += ANSI.color(`(`, markersColor);
          nextLinesSkippedDiff += summaryDetails.join(" ");
          nextLinesSkippedDiff += ANSI.color(`)`, markersColor);
        }
        nextLinesSkippedDiff += " ";
        nextLinesSkippedDiff += ANSI.color("↓", markersColor);
        diffLines.push(nextLinesSkippedDiff);
      }
      let separator = `\n`;
      if (context.textIndent && stringNode.useLineNumbersOnTheLeft) {
        separator += " ".repeat(context.textIndent);
      }
      return diffLines.join(separator);
    }
  };
  const writeOneLineDiff = (lineComparison, context) => {
    let { focusedCharIndex } = context;
    const charComparisons = lineComparison.childComparisons.chars;
    const lineNode = lineComparison[context.resultType];
    const charNodes = lineNode.childNodes.chars;
    const charBeforeArray = [];
    const charAfterArray = [];
    const actualNode = lineComparison.actualNode;
    const expectNode = lineComparison.expectNode;
    const resetModified =
      actualNode &&
      actualNode.canHaveChars &&
      expectNode &&
      expectNode.canHaveChars;
    const lineContext = {
      ...context,
      modified: resetModified ? false : context.modified,
    };

    let remainingWidth = context.maxColumns - context.textIndent;
    let focusedCharComparison = charComparisons[focusedCharIndex];
    if (!focusedCharComparison) {
      focusedCharIndex = charNodes.length - 1;
      focusedCharComparison = charComparisons[focusedCharIndex];
    }
    let focusedCharDiff = "";
    if (focusedCharComparison) {
      focusedCharDiff = writeDiff(focusedCharComparison, lineContext);
      remainingWidth -= stringWidth(focusedCharDiff);
    }

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
      const charDiff = writeDiff(charNode.comparison, lineContext);
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

    const overflowLeft =
      focusedCharIndex - previousCharAttempt > 0 || context.overflowLeft;
    const overflowRight =
      focusedCharIndex + nextCharAttempt < charNodes.length - 1 ||
      context.overflowRight;
    let lineDiff = "";
    if (context.collapsed || context.collapsedWithOverview) {
    } else if (context.useLineNumbersOnTheLeft) {
      const lineNumberColor = pickColor(lineComparison, context);
      const lineNumberString = String(lineComparison.index + 1);
      if (
        context.biggestLineIndex &&
        String(context.biggestLineIndex + 1).length > lineNumberString.length
      ) {
        lineDiff += " ";
      }
      lineDiff += ANSI.color(lineNumberString, lineNumberColor);
      // lineDiff += " ";
      lineDiff += ANSI.color("|", lineNumberColor);
      lineDiff += " ";
    }
    const overflowMarkersColor = pickColor(lineComparison, context);
    if (overflowLeft) {
      lineDiff += ANSI.color("…", overflowMarkersColor);
    }
    let quoteDiff = "";
    if (context.quotes) {
      const quoteColor = pickDelimitersColor(lineComparison, context);
      quoteDiff += ANSI.color(context.quotes, quoteColor);
    }
    if (quoteDiff) {
      lineDiff += quoteDiff;
    }
    lineDiff += charBeforeArray.reverse().join("");
    lineDiff += focusedCharDiff;
    lineDiff += charAfterArray.join("");
    if (quoteDiff) {
      lineDiff += quoteDiff;
    }
    if (overflowRight) {
      lineDiff += ANSI.color("…", overflowMarkersColor);
    }
    return lineDiff;
  };
  const writeCharDiff = (charComparison, context) => {
    const node = charComparison[context.resultType];
    const { preserveLineBreaks, quotes } = context;
    const char = node.value;
    const charColor = pickColor(charComparison, context, (node) => node.value);
    if (preserveLineBreaks && (char === "\n" || char === "\r")) {
      return ANSI.color(char, charColor);
    }
    const point = char.charCodeAt(0);
    if (
      (quotes && char === quotes) ||
      point === 92 ||
      point < 32 ||
      (point > 126 && point < 160) ||
      // line separators
      point === 8232 ||
      point === 8233
    ) {
      const replacement =
        char === quotes
          ? `\\${quotes}`
          : point === 8232
            ? "\\u2028"
            : point === 8233
              ? "\\u2029"
              : charMeta[point];
      return ANSI.color(replacement, charColor);
    }
    return ANSI.color(char, charColor);
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
  //     const expectHasPassword = passwordComparison.expectNode.value.length;
  //     let passwordSeparatorColor;
  //     if (actualHasPassword && !expectHasPassword) {
  //       passwordSeparatorColor = addedColor;
  //     } else if (!actualHasPassword && expectHasPassword) {
  //       passwordSeparatorColor = removedColor;
  //     } else if (passwordComparison.reasons.overall.any.size) {
  //       passwordSeparatorColor =
  //         context.resultColor;
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
  //       const expectHasAuth =
  //         usernameComparison.expectNode.value.length ||
  //         passwordComparison.expectNode.value.length;
  //       let authSeparatorColor;
  //       if (actualHasAuth && !expectHasAuth) {
  //         authSeparatorColor = addedColor;
  //       } else if (!actualHasAuth && expectHasAuth) {
  //         authSeparatorColor = removedColor;
  //       } else if (
  //         passwordComparison[context.resultType].length
  //           ? passwordComparison.reasons.overall.any.size
  //           : usernameComparison.reasons.overall.any.size
  //       ) {
  //         authSeparatorColor =
  //           context.resultColor;
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
  //       const expectHasPort =
  //         String(portComparison.expectNode.value).length > 0;
  //       let portSeparatorColor;
  //       if (actualHasPort && !expectHasPort) {
  //         portSeparatorColor = addedColor;
  //       } else if (!actualHasPort && expectHasPort) {
  //         portSeparatorColor = removedColor;
  //       } else if (portComparison.reasons.overall.any.size) {
  //         portSeparatorColor =
  //           context.resultColor;
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
  //     const expectHasSearch = searchComparison.expectNode.value.length;
  //     let searchSeparatorColor;
  //     if (actualHasSearch && !expectHasSearch) {
  //       searchSeparatorColor = addedColor;
  //     } else if (!actualHasSearch && expectHasSearch) {
  //       searchSeparatorColor = removedColor;
  //     } else if (searchComparison.reasons.overall.any.size) {
  //       searchSeparatorColor =
  //         context.resultColor;
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
  //     const expectHasHash = hashComparison.expectNode.value.length;
  //     let hashSeparatorColor;
  //     if (actualHasHash && !expectHasHash) {
  //       hashSeparatorColor = addedColor;
  //     } else if (!actualHasHash && expectHasHash) {
  //       hashSeparatorColor = removedColor;
  //     } else if (hashComparison.reasons.overall.any.size) {
  //       hashSeparatorColor =
  //         context.resultColor;
  //     } else {
  //       hashSeparatorColor = sameColor;
  //     }
  //     urlDiff += ANSI.color("#", hashSeparatorColor);
  //     urlDiff += hashDiff;
  //   }
  //   urlDiff += ANSI.color(`"`, bracketColor);
  //   return urlDiff;
  // };

  const createIndexedPropertyComparisonIterable = (node) => {
    const indexedPropertyMap = node.childNodes.indexedPropertyMap;
    const indexedPropertyNodes = Array.from(indexedPropertyMap.values());
    const indexedPropertyComparisons = indexedPropertyNodes.map(
      (indexedPropertyNode) => indexedPropertyNode.comparison,
    );
    return indexedPropertyComparisons;
  };
  const createMapEntryComparisonIterable = (node) => {
    const mapEntryNodeMap = node.childNodes.mapEntryMap;
    const mapEntryNodes = Array.from(mapEntryNodeMap.values());
    const mapEntryComparisons = mapEntryNodes.map(
      (mapEntryNode) => mapEntryNode.comparison,
    );
    return mapEntryComparisons;
  };
  const createNamedPropertyComparisonIterable = (node) => {
    const namedPropertyNodeMap = node.childNodes.namedPropertyMap;
    const propertyNames = Array.from(namedPropertyNodeMap.keys());
    if (node.functionAnalysis.type === "class") {
      const prototypePropertyIndex = propertyNames.indexOf("prototype");
      if (prototypePropertyIndex > -1) {
        propertyNames.splice(prototypePropertyIndex, 1);
        propertyNames.push("prototype");
      }
    }
    const propertyComparisons = propertyNames.map(
      (propertyName) => namedPropertyNodeMap.get(propertyName).comparison,
    );

    let internalValueNode = node.childNodes.internalValue;
    let internalValueComparison;
    if (internalValueNode && internalValueNode.displayedIn === "properties") {
      internalValueComparison = internalValueNode.comparison;
    }
    let prototypeNode = node.childNodes.prototype;
    let prototypeComparison;
    if (
      prototypeNode &&
      // when function are rendered the prototype is implicit
      // "function () {}" implies Function.prototype
      // "async function () {}" implies AsyncFunction
      !prototypeNode.parent.isFunction
    ) {
      prototypeComparison = prototypeNode.comparison;
    }

    if (node.isClassPrototype) {
      return [
        ...(internalValueComparison ? [internalValueComparison] : []),
        ...propertyComparisons,
        ...(prototypeComparison ? [prototypeComparison] : []),
      ];
    }
    return [
      ...(internalValueComparison ? [internalValueComparison] : []),
      ...(prototypeComparison ? [prototypeComparison] : []),
      ...propertyComparisons,
    ];
  };

  const getValueColor = (comparison, context) => {
    if (context.removed || context.added) {
      return context.resultColorWhenSolo;
    }
    if (!context.modified) {
      return sameColor;
    }
    const { actualNode, expectNode } = comparison;
    if (!actualNode || !expectNode) {
      return context.resultColor;
    }
    const actualInternalOrSelfNode =
      actualNode.childNodes.internalValue || actualNode;
    const expectInternalOrSelfNode =
      expectNode.childNodes.internalValue || expectNode;
    const internalOrSelfNode =
      actualInternalOrSelfNode.type === "internal_value"
        ? actualInternalOrSelfNode
        : expectInternalOrSelfNode;
    if (!internalOrSelfNode.comparison.hasAnyDiff) {
      return sameColor;
    }
    return context.resultColor;
  };
}

const isComposite = (value) => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
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
const isValidPropertyIdentifier = (propertyName) => {
  return (
    typeof propertyName === "number" ||
    !isNaN(propertyName) ||
    isDotNotationAllowed(propertyName)
  );
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
    append: (property, { isArrayIndex, isPropertyDescriptor, isMeta } = {}) => {
      let propertyKey = "";
      let propertyKeyCanUseDot = false;
      if (isArrayIndex) {
        propertyKey = `[${property}]`;
      } else if (typeof property === "symbol") {
        propertyKey = humanizeSymbol(property);
      } else if (typeof property === "string") {
        if (isDotNotationAllowed(property)) {
          propertyKey = property;
          propertyKeyCanUseDot = true;
        } else {
          propertyKey = `"${property}"`; // TODO: property escaping
        }
      } else {
        propertyKey = String(property);
        propertyKeyCanUseDot = true;
      }
      let propertyPathString;
      if (path) {
        if (isPropertyDescriptor || isMeta) {
          propertyKey = `[[${propertyKey}]]`;
        } else if (propertyKeyCanUseDot) {
          propertyKey = `.${propertyKey}`;
        } else {
          propertyKey = `[${propertyKey}]`;
        }
        propertyPathString = `${path}${propertyKey}`;
      } else {
        propertyPathString = propertyKey;
      }
      return createValuePath(propertyPathString);
    },
  };
};

const AsyncFunction = async function () {}.constructor;
const GeneratorFunction = function* () {}.constructor;
const AsyncGeneratorFunction = async function* () {}.constructor;

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
let getWellKnownId;
{
  const wellKnownWeakMap = new WeakMap();
  const symbolWellKnownMap = new Map();
  getWellKnownId = (value) => {
    if (!wellKnownWeakMap.size) {
      visitValue(global, createValuePath());
      visitValue(AsyncFunction, createValuePath("AsyncFunction"));

      visitValue(GeneratorFunction, createValuePath("GeneratorFunction"));
      visitValue(
        AsyncGeneratorFunction,
        createValuePath("AsyncGeneratorFunction"),
      );
    }
    if (typeof value === "symbol") {
      return symbolWellKnownMap.get(value);
    }
    return wellKnownWeakMap.get(value);
  };

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
}

const splitChars = (string) => {
  // eslint-disable-next-line new-cap
  const splitter = new Graphemer.default();
  return splitter.splitGraphemes(string);
};

const pickColor = (comparison, context, getter, { preferSolorColor } = {}) => {
  if (context.removed || context.added) {
    return context.resultColorWhenSolo;
  }
  if (context.modified) {
    const otherNode = comparison[context.otherResultType];
    if (!otherNode) {
      return preferSolorColor
        ? context.resultColorWhenSolo
        : context.resultColor;
    }
    if (otherNode.hidden) {
      return context.resultColorWhenSolo;
    }
    if (!getter) {
      return sameColor;
    }
    const node = comparison[context.resultType];
    const currentValue = getter(node);
    const otherValue = getter(otherNode);
    if (currentValue !== otherValue) {
      return preferSolorColor
        ? context.resultColorWhenSolo
        : context.resultColor;
    }
  }
  return sameColor;
};
const pickDelimitersColor = (comparison, context) => {
  return pickColor(comparison, context, (node) => {
    const internalOrSelfNode = node.childNodes.internalValue || node;
    return internalOrSelfNode.openDelimiter;
  });
};
const pickColorAccordingToChild = (comparison, context, getter) => {
  if (context.removed || context.added) {
    return context.resultColorWhenSolo;
  }
  if (context.modified || comparison.hasAnyDiff) {
    const node = comparison[context.resultType];
    const otherNode = comparison[context.otherResultType];
    if (!otherNode) {
      return context.resultColor;
    }
    let childNodes = getter(node);
    let someSolo = false;
    for (const childNode of childNodes) {
      const childComparison = childNode.comparison;
      if (childComparison.reasons.overall.modified.size > 0) {
        return context.resultColor;
      }
      if (
        childComparison.reasons.overall.added.size ||
        childComparison.reasons.overall.removed.size
      ) {
        someSolo = true;
      }
    }
    if (someSolo) {
      return context.resultColorWhenSolo;
    }
  }
  return sameColor;
};

const pickSelfOrInternalNode = (node, getter) => {
  if (!node) {
    return null;
  }
  if (getter(node)) {
    return node;
  }
  const internalValueNode = node.childNodes.internalValue;
  if (internalValueNode && getter(internalValueNode)) {
    return internalValueNode;
  }
  return null;
};

const getFocusedCharIndex = (comparison, context) => {
  const node = comparison[context.resultType];
  const charComparisons = comparison.childComparisons.chars;
  const charWithDiffIndex = node.childNodes.chars.findIndex((_, index) => {
    const charComparison = charComparisons[index];
    return charComparison.hasAnyDiff;
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
