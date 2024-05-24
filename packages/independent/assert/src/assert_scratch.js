/*
 * LE PLUS DUR QU'IL FAUT FAIRE AVANT TOUT:
 *
 * - le nom de l'objet avant les props genre User { foo: "bar" }
 * - internal value
 *   - set
 *   - map
 * - indexed value
 * - shortcut lorsque la actual === expect
 *   (en gros on a pas besoin de comparer inside)
 *   pour les objet on auara besoin de découvrir X props pour les render
 *   pour les primitives rien, on print la primitive tel quel
 * - functions
 * - strings avec mutiline
 * - no need to break loop when max diff is reached
 *   en fait si pour string par exemple on voudra s'arreter
 *   mais pour un objet, un array un buffer on parcourira tout
 *   parce que on le fait de toute façon lorsqu'il n'y a pas de diff
 *   aussi ici du coup lorsque les props sont skipped
 *   le résumé doit etre de la bonne couleur en fonctio de ce qui se passe dedans
 * - url string
 * - url object
 * - associative array
 * - well known
 * - property descriptors
 * - colors
 *
 */

import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isValidPropertyIdentifier } from "./property_identifier.js";
import { createValuePath } from "./value_path.js";

const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectColor = ANSI.RED;
const expectColor = ANSI.GREEN;
/**
 * When a js value CANNOT EXISTS in actual or expected
 * the missing Node is set to PLACEHOLDER_FOR_NOTHING
 * For example,
 * - actual is a primitive, it cannot have properties
 * - expect is a composite, it can have properties
 * -> result into something like this
 * actual: true {
 *   <a>PLACEHOLDER_FOR_NOTHING
 * }
 * expect: {
 *   <a>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_FOR_NOTHING = {
  placeholder: "nothing",
};
/**
 * When a js value DOES NOT EXISTS ANYMORE in actual or expected
 * the missing Node is set to PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * For example,
 * - actual has 2 properties: "a" and "b"
 * - expect has 2 propertie: "a" and "c"
 * -> result into something like this
 * actual: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>ownPropertyDescriptorEntry,
 *   <c>PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * },
 * expect: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
 *   <c>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_WHEN_ADDED_OR_REMOVED = {
  placeholder: "added_or_removed",
};

const setColor = (text, color) => {
  if (text.trim() === "") {
    // cannot set color of blank chars
    return text;
  }
  return ANSI.color(text, color);
};

export const assert = ({
  actual,
  expect,
  MAX_PROP_BEFORE_DIFF = 2,
  MAX_PROP_AFTER_DIFF = 2,
  MAX_DEPTH = 5,
  MAX_DEPTH_INSIDE_DIFF = 1,
  MAX_DIFF_PER_OBJECT = 2,
  MAX_COLUMNS = 100,
}) => {
  const rootActualNode = createRootNode({
    colorWhenSolo: addedColor,
    colorWhenSame: sameColor,
    colorWhenModified: unexpectColor,
    name: "actual",
    type: "root",
    value: actual,
    otherValue: expect,
  });
  const rootExpectNode = createRootNode({
    colorWhenSolo: removedColor,
    colorWhenSame: sameColor,
    colorWhenModified: expectColor,
    name: "expect",
    type: "root",
    value: expect,
    otherValue: actual,
  });

  const causeSet = new Set();
  let startActualNode = rootActualNode;
  let startExpectNode = rootExpectNode;
  const getNodeDepth = (node) => {
    if (node.name === "actual") {
      return node.depth - startActualNode.depth;
    }
    return node.depth - startExpectNode.depth;
  };

  /*
   * Comparison are objects used to compare actualNode and expectNode
   * It is used to visit all the entry a js value can have
   * and progressively create a tree of node and comparison
   * as the visit progresses a diff is generated
   * In the process an other type of object is used called *Entry
   * The following entry exists:
   * - ownPropertyDescriptorEntry
   * - ownPropertySymbolEntry
   * - indexedEntry
   *   - array values
   *   - typed array values
   *   - string values
   * - internalEntry
   *   - url internal props
   *   - valueOf()
   *   - Symbol.toPrimitive()
   *   - function body
   *   - map keys and values
   *   - ....
   * Entry represent something that can be found in the js value
   * and can be associated with one or many node (js_value)
   * For example ownPropertyDescriptorEntry have 3 nodes:
   *   ownPropertyNameNode
   *   descriptorKeyNode
   *   descriptorValueNode
   */
  const compare = (actualNode, expectNode) => {
    const reasons = createReasons();
    const comparison = {
      isComparison: true,
      actualNode,
      expectNode,
      depth: actualNode.depth || expectNode.depth,
      isContainer: actualNode.isContainer || expectNode.isContainer,
      parent: null,
      reasons,
      done: false,
    };

    const onSelfDiff = (reason) => {
      reasons.self.modified.add(reason);
      causeSet.add(comparison);
    };
    const onAdded = (reason) => {
      reasons.self.added.add(reason);
      causeSet.add(comparison);
    };
    const onRemoved = (reason) => {
      reasons.self.removed.add(reason);
      causeSet.add(comparison);
    };
    const renderPrimitiveDiff = (node, { columnsRemaining }) => {
      let diff = "";
      if (columnsRemaining < 2) {
        diff = setColor("…", node.color);
        return diff;
      }
      let valueDiff;
      if (node.isString) {
        valueDiff = JSON.stringify(node.value);
        if (!node.useQuotes) {
          valueDiff = valueDiff.slice(1, -1);
        }
      } else if (node.isFunction) {
        valueDiff = "function";
      } else {
        valueDiff = JSON.stringify(node.value);
      }
      if (valueDiff.length > columnsRemaining) {
        diff += setColor(valueDiff.slice(0, columnsRemaining - 1), node.color);
        diff += setColor("…", node.color);
      } else {
        diff += setColor(valueDiff, node.color);
      }
      return diff;
    };
    const renderCompositeDiff = (node, props) => {
      // it's here that at some point we'll compare more than just own properties
      // because composite also got a prototype
      // and a constructor that might differ
      let diff = "";
      const ownPropertiesNode = node.ownPropertiesNode;
      const propertyNameCount = ownPropertiesNode.value.length;
      if (props.columnsRemaining < 2) {
        diff = setColor("…", node.color);
        return diff;
      }
      let maxDepthReached = false;
      if (node.diffType) {
        if (typeof props.firstDiffDepth === "number") {
          maxDepthReached =
            node.depth + props.firstDiffDepth > MAX_DEPTH_INSIDE_DIFF;
        } else {
          props.firstDiffDepth = node.depth;
          maxDepthReached = node.depth > MAX_DEPTH_INSIDE_DIFF;
        }
      } else {
        maxDepthReached = node.depth > MAX_DEPTH;
      }
      if (maxDepthReached) {
        diff += setColor(`Object(${propertyNameCount})`, node.color);
        return diff;
      }
      const wrappedValueNode = getWrappedValueNode(node);
      if (wrappedValueNode) {
        let columnsRemainingForWrappedValue = props.columnsRemaining;
        columnsRemainingForWrappedValue -= "Object() ".length;
        const wrappedValueDiff = wrappedValueNode.render({
          ...props,
          columnsRemaining: columnsRemainingForWrappedValue,
        });
        diff += setColor("Object(", node.color);
        diff += wrappedValueDiff;
        diff += setColor(")", node.color);
        diff += " ";
        const ownPropertiesDiff = ownPropertiesNode.render({
          ...props,
          hideDelimitersWhenEmpty: true,
        });
        diff += ownPropertiesDiff;
        return diff;
      }
      const ownPropertiesDiff = ownPropertiesNode.render(props);
      diff += ownPropertiesDiff;
      return diff;
    };

    const renderProperties = (node, { mode, ...props }) => {
      if (mode === "multiline") {
        return renderPropertiesMultiline(node, props);
      }
      if (mode === "one_liner" || mode === "without_diff") {
        return renderPropertiesOneLiner(node, props);
      }
      throw new Error(`cannot render properties with "${mode}" mode`);
    };
    const renderPropertiesMultiline = (
      node,
      { ownPropertyNodeMap, indexToDisplayArray, ...props },
    ) => {
      let atLeastOnePropertyDisplayed = false;
      let diff = "";
      let propertiesDiff = "";
      const ownPropertyNames = node.value;
      const appendProperty = (propertyDiff) => {
        if (atLeastOnePropertyDisplayed) {
          propertiesDiff += "\n";
          propertiesDiff += propertyDiff;
        } else {
          propertiesDiff += propertyDiff;
          atLeastOnePropertyDisplayed = true;
        }
      };
      const appendSkippedProps = (skipCount, sign) => {
        let skippedPropDiff = "";
        skippedPropDiff += "  ".repeat(getNodeDepth(node) + 1);
        skippedPropDiff += setColor(sign, node.color);
        skippedPropDiff += " ";
        skippedPropDiff += setColor(String(skipCount), node.color);
        skippedPropDiff += " ";
        skippedPropDiff += setColor(
          skipCount === 1 ? "prop" : "props",
          node.color,
        );
        skippedPropDiff += " ";
        skippedPropDiff += setColor(sign, node.color);
        appendProperty(skippedPropDiff);
      };
      let previousIndexDisplayed = -1;
      for (const indexToDisplay of indexToDisplayArray) {
        if (previousIndexDisplayed === -1) {
          if (indexToDisplay > 0) {
            appendSkippedProps(indexToDisplay, "↑");
          }
        } else {
          const intermediateSkippedCount =
            indexToDisplay - previousIndexDisplayed - 1;
          if (intermediateSkippedCount) {
            appendSkippedProps(intermediateSkippedCount, "↕");
          }
        }
        const propertyName = ownPropertyNames[indexToDisplay];
        const propertyNode = ownPropertyNodeMap.get(propertyName);
        let propertyDiff = "";
        propertyDiff += "  ".repeat(getNodeDepth(propertyNode) + 1);
        propertyDiff += propertyNode.render({
          ...props,
          // reset remaining width
          columnsRemaining: MAX_COLUMNS - propertyDiff.length,
          commaSeparator: true,
        });
        appendProperty(propertyDiff);
        previousIndexDisplayed = indexToDisplay;
      }
      const lastIndexDisplayed = previousIndexDisplayed;
      if (lastIndexDisplayed > -1) {
        const lastSkippedCount =
          ownPropertyNames.length - 1 - lastIndexDisplayed;
        if (lastSkippedCount) {
          appendSkippedProps(lastSkippedCount, `↓`);
        }
      }
      if (atLeastOnePropertyDisplayed) {
        diff += setColor("{", node.color);
        diff += "\n";
        diff += propertiesDiff;
        diff += "\n";
        diff += "  ".repeat(getNodeDepth(node));
        diff += setColor("}", node.color);
      } else if (props.hideDelimitersWhenEmpty) {
      } else {
        diff += setColor("{", node.color);
        diff += setColor("}", node.color);
      }
      return diff;
    };
    const renderPropertiesOneLiner = (
      node,
      { ownPropertyNodeMap, ...props },
    ) => {
      const ownPropertyNames = node.value;
      if (ownPropertyNames.length === 0) {
        return "{}";
      }
      let columnsRemaining = props.columnsRemaining;
      let boilerplate = "{ ... }";
      columnsRemaining -= boilerplate.length;
      let diff = "";
      let propertiesDiff = "";
      let atLeastOnePropertyDisplayed = false;
      for (const ownPropertyName of ownPropertyNames) {
        const ownPropertyNode = ownPropertyNodeMap.get(ownPropertyName);
        const propertyDiff = ownPropertyNode.render({
          ...props,
          columnsRemaining,
          commaSeparator: false,
        });
        const propertyDiffWidth = stringWidth(propertyDiff);
        if (propertyDiffWidth > columnsRemaining) {
          if (atLeastOnePropertyDisplayed) {
            diff += setColor("{", node.color);
            diff += propertiesDiff;
            diff += setColor(" ... }", node.color);
            return diff;
          }
          diff += setColor("{ ... }", node.color);
          return diff;
        }
        if (atLeastOnePropertyDisplayed) {
          propertiesDiff += setColor(",", node.color);
          propertiesDiff += " ";
        } else {
          atLeastOnePropertyDisplayed = true;
        }
        propertiesDiff += propertyDiff;
        columnsRemaining -= propertyDiffWidth;
      }
      diff += setColor("{", node.color);
      diff += " ";
      diff += propertiesDiff;
      diff += " ";
      diff += setColor("}", node.color);
      return diff;
    };
    const renderPropertyDiff = (node, props) => {
      let propertyDiff = "";
      const commaSeparator = props.commaSeparator;
      let columnsRemaining = props.columnsRemaining;
      const propertyNameNode = node.propertyNameNode;
      if (commaSeparator) {
        columnsRemaining -= ",".length;
      }
      const propertyNameDiff = propertyNameNode.render({
        ...props,
        columnsRemaining,
      });
      propertyDiff += propertyNameDiff;
      let columnsRemainingForValue =
        columnsRemaining - stringWidth(propertyNameDiff);
      if (columnsRemainingForValue > ": ".length) {
        propertyDiff += setColor(":", node.color);
        propertyDiff += " ";
        columnsRemainingForValue -= ": ".length;
        const propertyValueNode = node.propertyValueNode;
        propertyDiff += propertyValueNode.render({
          ...props,
          columnsRemaining: columnsRemainingForValue,
        });
        if (commaSeparator) {
          propertyDiff += setColor(",", node.color);
        }
      } else if (commaSeparator) {
        propertyDiff += setColor(",", node.color);
      }
      return propertyDiff;
    };
    const getIndexToDisplayArray = (diffIndexArray, names) => {
      const indexToDisplaySet = new Set();
      let diffCount = 0;
      for (const diffIndex of diffIndexArray) {
        if (diffCount >= MAX_DIFF_PER_OBJECT) {
          break;
        }
        diffCount++;
        let beforeDiffIndex = diffIndex - 1;
        let beforeCount = 0;
        while (beforeDiffIndex > -1) {
          if (beforeCount === MAX_PROP_BEFORE_DIFF) {
            break;
          }
          indexToDisplaySet.add(beforeDiffIndex);
          beforeCount++;
          beforeDiffIndex--;
        }
        indexToDisplaySet.add(diffIndex);
        let afterDiffIndex = diffIndex + 1;
        let afterCount = 0;
        while (afterDiffIndex < names.length) {
          if (afterCount === MAX_PROP_AFTER_DIFF) {
            break;
          }
          indexToDisplaySet.add(afterDiffIndex);
          afterCount++;
          afterDiffIndex--;
        }
      }
      return Array.from(indexToDisplaySet);
    };

    const subcompareDuo = (actualChildNode, expectChildNode) => {
      const childComparison = compare(actualChildNode, expectChildNode);
      childComparison.parent = comparison;
      appendReasonGroup(
        comparison.reasons.inside,
        childComparison.reasons.overall,
      );
      return childComparison;
    };
    const subcompareSolo = (childNode, placeholderNode) => {
      if (childNode.name === "actual") {
        return subcompareDuo(childNode, placeholderNode);
      }
      return subcompareDuo(placeholderNode, childNode);
    };

    const visitDuo = (actualNode, expectNode) => {
      if (actualNode.isPrimitive) {
        // comparing primitives
        if (actualNode.value === expectNode.value) {
          // we already know there will be no diff
          // but for now we'll still visit the primitive constituents
        } else {
          onSelfDiff("primitive_value");
        }
        actualNode.render = (props) => renderPrimitiveDiff(actualNode, props);
        expectNode.render = (props) => renderPrimitiveDiff(expectNode, props);
        return;
      }
      if (actualNode.isComposite) {
        const actualWrappedValueNode = getWrappedValueNode(actualNode);
        const expectWrappedValueNode = getWrappedValueNode(expectNode);
        if (actualWrappedValueNode && expectWrappedValueNode) {
          subcompareDuo(actualWrappedValueNode, expectWrappedValueNode);
        } else if (actualWrappedValueNode) {
          subcompareSolo(actualWrappedValueNode);
        } else if (expectWrappedValueNode) {
          subcompareSolo(expectWrappedValueNode);
        }
        const actualOwnPropertiesNode = createOwnPropertiesNode(actualNode);
        const expectOwnPropertiesNode = createOwnPropertiesNode(expectNode);
        subcompareDuo(actualOwnPropertiesNode, expectOwnPropertiesNode);
        actualNode.render = (props) => renderCompositeDiff(actualNode, props);
        expectNode.render = (props) => renderCompositeDiff(expectNode, props);
        return;
      }
      if (actualNode.type === "own_properties") {
        const actualOwnPropertyNames = actualNode.value;
        const expectOwnPropertyNames = expectNode.value;
        const actualOwnPropertyNodeMap = new Map();
        const expectOwnPropertyNodeMap = new Map();
        const getActualOwnPropertyNode = (propName) => {
          const actualOwnPropertyNode = createOwnPropertyNode(
            actualNode,
            propName,
          );
          actualOwnPropertyNodeMap.set(propName, actualOwnPropertyNode);
          return actualOwnPropertyNode;
        };
        const getExpectOwnPropertyNode = (propName) => {
          const expectOwnPropertyNode = createOwnPropertyNode(
            expectNode,
            propName,
          );
          expectOwnPropertyNodeMap.set(propName, expectOwnPropertyNode);
          return expectOwnPropertyNode;
        };
        const subcompareOwnPropertyNodes = (
          propName,
          actualOwnPropertyNode,
          expectOwnPropertyNode,
        ) => {
          const ownPropertyComparison = subcompareDuo(
            actualOwnPropertyNode,
            expectOwnPropertyNode,
          );
          propComparisonMap.set(propName, ownPropertyComparison);
          return ownPropertyComparison;
        };
        const propComparisonMap = new Map();
        const diffPropertyNameSet = new Set();
        const actualDiffIndexArray = [];
        const expectDiffIndexArray = [];
        for (const actualPropName of actualOwnPropertyNames) {
          const actualOwnPropertyIndex =
            actualOwnPropertyNames.indexOf(actualPropName);
          const expectOwnPropertyIndex =
            expectOwnPropertyNames.indexOf(actualPropName);
          if (expectOwnPropertyIndex === -1) {
            const actualOwnPropertyNode =
              getActualOwnPropertyNode(actualPropName);
            subcompareOwnPropertyNodes(
              actualPropName,
              actualOwnPropertyNode,
              PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
            );
            actualDiffIndexArray.push(actualOwnPropertyIndex);
            diffPropertyNameSet.add(actualPropName);
            continue;
          }
          const actualOwnPropertyNode =
            getActualOwnPropertyNode(actualPropName);
          const expectOwnPropertyNode =
            getExpectOwnPropertyNode(actualPropName);
          const ownPropertyComparison = subcompareOwnPropertyNodes(
            actualPropName,
            actualOwnPropertyNode,
            expectOwnPropertyNode,
          );
          propComparisonMap.set(actualPropName, ownPropertyComparison);
          if (ownPropertyComparison.hasAnyDiff) {
            actualDiffIndexArray.push(actualOwnPropertyIndex);
            expectDiffIndexArray.push(expectOwnPropertyIndex);
            diffPropertyNameSet.add(actualPropName);
          }
        }
        for (const expectPropName of expectOwnPropertyNames) {
          if (propComparisonMap.has(expectPropName)) {
            continue;
          }
          const expectOwnPropertyIndex =
            expectOwnPropertyNames.indexOf(expectPropName);
          const expectOwnPropertyNode =
            getExpectOwnPropertyNode(expectPropName);
          subcompareOwnPropertyNodes(
            expectPropName,
            PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
            expectOwnPropertyNode,
          );
          expectDiffIndexArray.push(expectOwnPropertyIndex);
          diffPropertyNameSet.add(expectPropName);
        }
        if (diffPropertyNameSet.size === 0) {
          actualNode.render = (props) =>
            renderProperties(actualNode, {
              ...props,
              mode: "without_diff",
              ownPropertyNodeMap: actualOwnPropertyNodeMap,
            });
          expectNode.render = (props) =>
            renderProperties(expectNode, {
              ...props,
              mode: "without_diff",
              ownPropertyNodeMap: expectOwnPropertyNodeMap,
            });
          return;
        }
        actualNode.render = (props) =>
          renderProperties(actualNode, {
            ...props,
            mode: "multiline",
            indexToDisplayArray: getIndexToDisplayArray(
              actualDiffIndexArray.sort(),
              actualOwnPropertyNames,
            ),
            ownPropertyNodeMap: actualOwnPropertyNodeMap,
          });
        expectNode.render = (props) =>
          renderProperties(expectNode, {
            ...props,
            mode: "multiline",
            indexToDisplayArray: getIndexToDisplayArray(
              expectDiffIndexArray.sort(),
              expectOwnPropertyNames,
            ),
            ownPropertyNodeMap: expectOwnPropertyNodeMap,
          });
        return;
      }
      if (actualNode.type === "own_property") {
        subcompareDuo(actualNode.propertyNameNode, expectNode.propertyNameNode);
        subcompareDuo(
          actualNode.propertyValueNode,
          expectNode.propertyValueNode,
        );
        actualNode.render = (props) => renderPropertyDiff(actualNode, props);
        expectNode.render = (props) => renderPropertyDiff(expectNode, props);
        return;
      }
      throw new Error("wtf");
    };
    const visitSolo = (node, placeholderNode) => {
      if (node.isPrimitive) {
        node.render = (props) => renderPrimitiveDiff(node, props);
        return;
      }
      if (node.isComposite) {
        const wrappedValueNode = getWrappedValueNode(actualNode);
        if (wrappedValueNode) {
          subcompareSolo(wrappedValueNode, placeholderNode);
        }
        const ownPropertiesNode = createOwnPropertiesNode(node);
        subcompareSolo(ownPropertiesNode, placeholderNode);
        node.render = (props) => renderCompositeDiff(node, props);
        return;
      }
      if (node.type === "own_properties") {
        const ownPropertyNames = node.value;
        const indexToDisplayArray = [];
        const ownPropertyNodeMap = new Map();
        let index = 0;
        for (const propName of ownPropertyNames) {
          if (index >= MAX_DIFF_PER_OBJECT) {
            break;
          }
          const ownPropertyNode = createOwnPropertyNode(node, propName);
          ownPropertyNodeMap.set(propName, ownPropertyNode);
          subcompareSolo(ownPropertyNode, placeholderNode);
          indexToDisplayArray.push(index);
          index++;
        }
        node.render = (props) =>
          renderProperties(node, {
            ...props,
            mode: "multiline",
            indexToDisplayArray,
            ownPropertyNodeMap,
          });
        return;
      }
      if (node.type === "own_property") {
        subcompareSolo(node.propertyNameNode, placeholderNode);
        subcompareSolo(node.propertyValueNode, placeholderNode);
        node.render = (props) => renderPropertyDiff(node, props);
        return;
      }
      throw new Error("wtf");
    };

    visit: {
      // comparing primitives
      if (actualNode.isPrimitive && expectNode.isPrimitive) {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      // comparing composites
      if (actualNode.isComposite && expectNode.isComposite) {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      // comparing containers
      if (actualNode.isContainer && expectNode.isContainer) {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      // primitive vs composite
      if (actualNode.isPrimitive && expectNode.isComposite) {
        onSelfDiff("should_be_composite");
        const expectAsPrimitiveNode = asPrimitiveNode(expectNode);
        if (expectAsPrimitiveNode) {
          visitDuo(actualNode, expectAsPrimitiveNode);
        } else {
          visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
        }
        visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
        break visit;
      }
      // composite vs primitive
      if (actualNode.isComposite && expectNode.isPrimitive) {
        onSelfDiff("should_be_primitive");
        visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
        const actualAsPrimitiveNode = asPrimitiveNode(actualNode);
        if (actualAsPrimitiveNode) {
          visitDuo(actualAsPrimitiveNode, expectNode);
        } else {
          visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
        }
        break visit;
      }
      if (expectNode.placeholder) {
        onAdded(getAddedOrRemovedReason(actualNode));
        visitSolo(actualNode, expectNode);
        break visit;
      }
      if (actualNode.placeholder) {
        onRemoved(getAddedOrRemovedReason(expectNode));
        visitSolo(expectNode, actualNode);
        break visit;
      }
      throw new Error("wtf");
    }

    const { self, inside, overall } = comparison.reasons;
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

    const updateColor = (node) => {
      node.color = {
        solo: node.colorWhenSolo,
        modified: node.colorWhenModified,
        undefined: node.colorWhenSame,
      }[node.diffType];
    };

    if (actualNode.placeholder) {
      expectNode.diffType =
        actualNode === PLACEHOLDER_FOR_NOTHING ? "modified" : "solo";
      updateColor(expectNode);
    } else if (expectNode.placeholder) {
      actualNode.diffType =
        expectNode === PLACEHOLDER_FOR_NOTHING ? "modified" : "solo";
      updateColor(actualNode);
    } else if (comparison.selfHasModification) {
      actualNode.diffType = expectNode.diffType = "modified";
      updateColor(actualNode);
      updateColor(expectNode);
    } else {
      updateColor(actualNode);
      updateColor(expectNode);
    }
    return comparison;
  };

  const rootComparison = compare(rootActualNode, rootExpectNode);
  if (!rootComparison.hasAnyDiff) {
    return;
  }

  let diff = ``;
  const infos = [];

  start_on_max_depth: {
    if (rootComparison.selfHasModification) {
      break start_on_max_depth;
    }
    let topMostComparisonWithDiff = null;
    for (const comparisonWithDiff of causeSet) {
      if (
        !topMostComparisonWithDiff ||
        comparisonWithDiff.depth < topMostComparisonWithDiff.depth
      ) {
        topMostComparisonWithDiff = comparisonWithDiff;
      }
    }
    if (topMostComparisonWithDiff.depth < MAX_DEPTH) {
      break start_on_max_depth;
    }
    let currentComparison = topMostComparisonWithDiff;
    let startDepth = topMostComparisonWithDiff.depth - MAX_DEPTH;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const parentComparison = currentComparison.parent;
      if (parentComparison) {
        if (
          !parentComparison.isContainer &&
          parentComparison.depth === startDepth
        ) {
          startActualNode = parentComparison.actualNode;
          startExpectNode = parentComparison.expectNode;
          const path = startActualNode.path || startExpectNode.path;
          infos.push(`diff starts at ${ANSI.color(path, ANSI.YELLOW)}`);
          break;
        }
        currentComparison = parentComparison;
      } else {
        break;
      }
    }
  }

  if (infos.length) {
    for (const info of infos) {
      diff += `${UNICODE.INFO} ${info}`;
      diff += "\n";
    }
    diff += "\n";
  }

  diff += ANSI.color("actual:", sameColor);
  diff += " ";
  diff += startActualNode.render({
    columnsRemaining: MAX_COLUMNS - "actual: ".length,
  });
  diff += `\n`;
  diff += ANSI.color("expect:", sameColor);
  diff += " ";
  diff += startExpectNode.render({
    columnsRemaining: MAX_COLUMNS - "expect: ".length,
  });
  throw diff;
};

let createRootNode;

/*
 * Node represent any js value.
 * These js value are compared and converted to a readable string
 * Node art part of a tree structure (parent/children) and contains many
 * information about the value such as
 * - Is it a primitive or a composite?
 * - Where does the value come from?
 *   - property key
 *   - property value
 *   - prototype value returned by Object.getPrototypeOf()
 *   - a map entry key
 * - And finally info useful to render the js value into a readable string
 */
{
  createRootNode = ({
    colorWhenSolo,
    colorWhenSame,
    colorWhenModified,
    name,
    type,
    value,
  }) => {
    const rootNode = createNode({
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
      type,
      value,
      parent: null,
      depth: 0,
      path: createValuePath(),
      meta: {},
    });

    return rootNode;
  };

  const createNode = ({
    colorWhenSolo,
    colorWhenSame,
    colorWhenModified,
    name,
    type,
    value,
    parent,
    depth,
    path,
    isContainer,
    meta = {},
  }) => {
    const node = {
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
      type,
      value,
      parent,
      depth,
      path,
      isContainer,
      meta,
      appendChild: ({
        type,
        isContainer,
        value,
        depth = isContainer ? node.depth : node.depth + 1,
        path = node.path,
      }) => {
        const childNode = createNode({
          colorWhenSolo: node.colorWhenSolo,
          colorWhenSame: node.colorWhenSame,
          colorWhenModified: node.colorWhenModified,
          name: node.name,
          type,
          value,
          parent: node,
          depth,
          path,
          isContainer,
        });
        return childNode;
      },
      // info
      isPrimitive: false,
      isComposite: false,
      isSymbol: false,
      // render info
      render: () => {
        throw new Error(`render not implemented for ${type}`);
      },
    };

    if (value === PLACEHOLDER_FOR_NOTHING) {
      return node;
    }
    if (value === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
      return node;
    }
    if (isContainer) {
      return node;
    }
    if (type === "own_property_name") {
      node.isPrimitive = true;
      node.isString = true;
      if (isValidPropertyIdentifier(value)) {
        node.useQuotes = false;
      } else {
        node.useQuotes = true;
      }
      return node;
    }
    if (type === "own_property_symbol") {
      node.isPrimitive = true;
      node.isSymbol = true;
      return node;
    }
    if (value === null) {
      node.isPrimitive = true;
      return node;
    }
    const typeofResult = typeof value;
    if (typeofResult === "object") {
      node.isComposite = true;
      node.valueStartDelimiter = "{";
      node.valueEndDelimiter = "}";
      const ownPropertyNames = [];
      if (
        typeof value.valueOf === "function" &&
        value.valueOf !== Object.prototype.valueOf
      ) {
        const valueOfReturnValue = value.valueOf();
        createValueOfReturnValueNode(node, valueOfReturnValue);
      }
      for (const ownPropertyName of Object.getOwnPropertyNames(value)) {
        if (shouldIgnoreOwnPropertyName(node, ownPropertyName)) {
          continue;
        }
        ownPropertyNames.push(ownPropertyName);
      }
      node.ownPropertyNames = ownPropertyNames;
      return node;
    }
    if (typeofResult === "function") {
      node.isPrimitive = true; // not really but for now yes
      node.isFunction = true;
      return node;
    }

    node.isPrimitive = true;
    if (typeofResult === "string") {
      node.isString = true;
      node.useQuotes = true;
    }
    return node;
  };
}

const getAddedOrRemovedReason = (node) => {
  if (node.type === "own_property") {
    return getAddedOrRemovedReason(node.propertyNameNode);
  }
  if (node.type === "own_property_name") {
    return node.value;
  }
  if (node.type === "own_property_value") {
    return getAddedOrRemovedReason(node.parent);
  }
  if (node.type === "value_of_return_value") {
    return "value_of_own_method";
  }
  return "unknown";
};
const asPrimitiveNode = (node) => {
  const wrappedValueNode = node.valueOfReturnValueNode;
  if (wrappedValueNode && wrappedValueNode.isPrimitive) {
    return wrappedValueNode;
  }
  return null;
};
const getWrappedValueNode = (node) => {
  return node.valueOfReturnValueNode;
};
const createOwnPropertiesNode = (node) => {
  const ownPropertiesNode = node.appendChild({
    type: "own_properties",
    isContainer: true,
    value: node.ownPropertyNames,
  });
  node.ownPropertiesNode = ownPropertiesNode;
  return ownPropertiesNode;
};
const createOwnPropertyNode = (node, ownPropertyName) => {
  const ownPropertyNode = node.appendChild({
    type: "own_property",
    isContainer: true,
    path: node.path.append(ownPropertyName),
  });
  ownPropertyNode.propertyNameNode = ownPropertyNode.appendChild({
    type: "own_property_name",
    value: ownPropertyName,
  });
  ownPropertyNode.propertyValueNode = ownPropertyNode.appendChild({
    type: "own_property_value",
    value: node.parent.value[ownPropertyName],
  });
  return ownPropertyNode;
};
const createValueOfReturnValueNode = (node, valueOfReturnValue) => {
  const valueOfReturnValueNode = node.appendChild({
    type: "value_of_return_value",
    value: valueOfReturnValue,
    path: node.path.append("valueOf()"),
    depth: node.depth,
  });
  node.valueOfReturnValueNode = valueOfReturnValueNode;
  return valueOfReturnValueNode;
};

const shouldIgnoreOwnPropertyName = (node, ownPropertyName) => {
  if (ownPropertyName === "prototype") {
    if (node.isFunction) {
      return false;
    }
    // ignore prototype if it's the default prototype
    // created by the runtime
    const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(
      node.value,
      ownPropertyName,
    );
    if (!Object.hasOwn(ownPropertyDescriptor, "value")) {
      return false;
    }
    const prototypeValue = ownPropertyDescriptor.value;
    if (node.isArrowFunction) {
      return prototypeValue === undefined;
    }
    if (node.isAsyncFunction && !node.isGeneratorFunction) {
      return prototypeValue === undefined;
    }
    const prototypeValueIsComposite = typeof prototypeValue === "object";
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
  if (ownPropertyName === "constructor") {
    // if (
    //   node.parent.key === "prototype" &&
    //   node.parent.parent.isFunction &&
    //   Object.hasOwn(ownPropertyDescriptor, "value") &&
    //   ownPropertyDescriptor.value === node.parent.parent.value
    // ) {
    return true;
    //  }
    //  break ignore;
  }
  if (ownPropertyName === "length") {
    return node.canHaveIndexedValues || node.isFunction;
  }
  if (ownPropertyName === "name") {
    return node.isFunction;
  }
  if (ownPropertyName === "stack") {
    return node.isError;
  }
  if (ownPropertyName === "valueOf") {
    return Boolean(node.valueOfReturnValueNode);
  }
  if (ownPropertyName === "toString") {
    return false;
    // return (
    //   node.childNodes.wrappedValue &&
    //   node.childNodes.wrappedValue.key === "toString()"
    // );
  }
  return false;
};
// const shouldIgnorePropertyDescriptor = (
//   node,
//   propertyKey,
//   descriptorKey,
//   descriptorValue,
// ) => {
//   /* eslint-disable no-unneeded-ternary */
//   if (descriptorKey === "writable") {
//     if (node.propsFrozen) {
//       return true;
//     }
//     const writableDefaultValue =
//       propertyKey === "prototype" && node.isClass ? false : true;
//     return descriptorValue === writableDefaultValue;
//   }
//   if (descriptorKey === "configurable") {
//     if (node.propsFrozen) {
//       return true;
//     }
//     if (node.propsSealed) {
//       return true;
//     }
//     const configurableDefaultValue =
//       propertyKey === "prototype" && node.isFunction ? false : true;
//     return descriptorValue === configurableDefaultValue;
//   }
//   if (descriptorKey === "enumerable") {
//     const enumerableDefaultValue =
//       (propertyKey === "prototype" && node.isFunction) ||
//       (propertyKey === "message" && node.isError) ||
//       node.isClassPrototype
//         ? false
//         : true;
//     return descriptorValue === enumerableDefaultValue;
//   }
//   /* eslint-enable no-unneeded-ternary */
//   if (descriptorKey === "get") {
//     return descriptorValue === undefined;
//   }
//   if (descriptorKey === "set") {
//     return descriptorValue === undefined;
//   }
//   return false;
// };

const createReasons = () => {
  const overall = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set(),
  };
  const self = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set(),
  };
  const inside = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set(),
  };

  return {
    overall,
    self,
    inside,
  };
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
