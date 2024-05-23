/*
 * LE PLUS DUR QU'IL FAUT FAIRE AVANT TOUT:
 *
 * - max depth
 *   lorsque la diff est tres profonde alors on skip ce qui est pareil pour afficher
 *   qu'a partir d'un certain point
 *   ça ça devrait etre facile en partant d'un point précis de l'arbre de comparaison
 * - map depth inside diff
 *   - lorsque une diff porte sur un objet (modified, added, removed)
 *   alors on print l'objet mais cela a une limite assez basse pour que on ai
 *   juste un aperçu sans heurter la lisibilité
 * - wrapped value
 * - added/removed prop
 *
 */

import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";
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
const MAX_PROP_BEFORE_DIFF = 2;
const MAX_PROP_AFTER_DIFF = 2;
const MAX_DEPTH = 5;

const setColor = (text, color) => {
  if (text.trim() === "") {
    // cannot set color of blank chars
    return text;
  }
  return ANSI.color(text, color);
};

export const assert = ({ actual, expect }) => {
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
    return node.depth - startActualNode.depth;
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
  const compare = (actualNode, expectNode, isAbstract) => {
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
      subcompare: (a, b, isAbstract) => {
        const childComparison = compare(a, b, isAbstract);
        childComparison.parent = comparison;
        appendReasonGroup(
          comparison.reasons.inside,
          childComparison.reasons.overall,
        );
        return childComparison;
      },
    };
    if (isAbstract) {
      return comparison;
    }

    const MAX_DIFF_PER_OBJECT = 2;

    const onSelfDiff = (reason) => {
      reasons.self.modified.add(reason);
      causeSet.add(comparison);
    };
    const renderPrimitiveDiff = (node) => {
      return JSON.stringify(node.value);
    };
    const renderPropertiesDiff = (
      node,
      { indexToDisplayArray, ownPropertyNodeMap },
    ) => {
      let atLeastOnePropertyDisplayed = false;
      let diff = "";
      let color = node.modified
        ? node.colorWhenModified
        : node.solo
          ? node.colorWhenSolo
          : node.colorWhenSame;
      let propertiesDiff = "";
      const ownPropertyNames = node.ownPropertyNames;
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
        skippedPropDiff += sign;
        skippedPropDiff += " ";
        skippedPropDiff += skipCount;
        skippedPropDiff += " ";
        skippedPropDiff += skipCount === 1 ? "prop" : "props";
        skippedPropDiff += " ";
        skippedPropDiff += sign;
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
            indexToDisplay - previousIndexDisplayed;
          if (intermediateSkippedCount) {
            appendSkippedProps(intermediateSkippedCount, "↕");
          }
        }
        const propertyName = ownPropertyNames[indexToDisplay];
        const propertyNode = ownPropertyNodeMap.get(propertyName);
        appendProperty(propertyNode.render());
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
        diff += setColor("{", color);
        diff += "\n";
        diff += propertiesDiff;
        diff += "\n";
        diff += "  ".repeat(getNodeDepth(node));
        diff += setColor("}", color);
      } else {
        diff += setColor("{", color);
        diff += setColor("}", color);
      }
      return diff;
    };
    const renderPropertiesWithoutDiff = (node, { ownPropertyNodeMap }) => {
      let diff = "";
      let propertiesDiff = "";
      let remainingWidth = 100;
      let boilerplate = "{, ... }";
      let atLeastOnePropertyDisplayed = false;
      remainingWidth -= boilerplate.length;
      const color = node.colorWhenSame;
      while (remainingWidth) {
        for (const ownPropertyName of node.ownPropertyNames) {
          const ownPropertyNode = ownPropertyNodeMap.get(ownPropertyName);
          const propertyDiff = ownPropertyNode.render();
          const propertyDiffWidth = stringWidth(propertyDiff);
          if (propertyDiffWidth > remainingWidth) {
            if (atLeastOnePropertyDisplayed) {
              diff += setColor("{", color);
              diff += propertiesDiff;
              diff += setColor(", ... }", color);
              return diff;
            }
            diff += setColor("{ ... }", color);
            return diff;
          }
          atLeastOnePropertyDisplayed = true;
          propertiesDiff += propertyDiff;
          remainingWidth -= propertyDiffWidth;
        }
      }
      diff += setColor("{", color);
      diff += propertiesDiff;
      diff += setColor("}", color);
      return diff;
    };
    const getIndexToDisplayArray = (diffIndexArray, names) => {
      const indexToDisplaySet = new Set();
      for (const diffIndex of diffIndexArray) {
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

    const visitSolo = (node) => {
      if (node.isPrimitive) {
        node.render = () => renderPrimitiveDiff(node);
        return;
      }
      if (node.isComposite) {
        const indexToDisplayArray = [];
        const ownPropertyNodeMap = new Map();
        let index = 0;
        for (const propName of node.ownPropertyNames) {
          const ownPropertyNode = createOwnPropertyNode(node, propName);
          ownPropertyNodeMap.set(propName, ownPropertyNode);
          if (node.name === "actual") {
            comparison.subcompare(ownPropertyNode, PLACEHOLDER_FOR_NOTHING);
          } else {
            comparison.subcompare(PLACEHOLDER_FOR_NOTHING, ownPropertyNode);
          }
          indexToDisplayArray.push(index);
          if (indexToDisplayArray.length > MAX_DIFF_PER_OBJECT) {
            break;
          }
          index++;
        }
        node.render = () => {
          return renderPropertiesDiff(node, {
            indexToDisplayArray,
            ownPropertyNodeMap,
          });
        };
      }
      throw new Error("wtf");
    };
    const visitDuo = () => {
      if (actualNode.isPrimitive) {
        // comparing primitives
        if (actualNode.value === expectNode.value) {
          // we already know there will be no diff
          // but for now we'll still visit the primitive constituents
        } else {
          onSelfDiff("primitive_value");
        }
        actualNode.render = () => renderPrimitiveDiff(actualNode);
        expectNode.render = () => renderPrimitiveDiff(expectNode);
        return;
      }
      if (actualNode.isComposite) {
        const actualOwnPropertyNames = actualNode.ownPropertyNames;
        const expectOwnPropertyNames = expectNode.ownPropertyNames;
        const actualOwnPropertyNodeMap = new Map();
        const expectOwnPropertyNodeMap = new Map();
        const propComparisonMap = new Map();
        const getPropComparison = (propName) => {
          if (propComparisonMap.has(propName)) {
            return propComparisonMap.get(propName);
          }
          const actualOwnPropertyNode = createOwnPropertyNode(
            actualNode,
            propName,
          );
          actualOwnPropertyNodeMap.set(propName, actualOwnPropertyNode);
          const expectOwnPropertyNode = createOwnPropertyNode(
            expectNode,
            propName,
          );
          expectOwnPropertyNodeMap.set(propName, expectOwnPropertyNode);
          const ownPropertyComparison = comparison.subcompare(
            actualOwnPropertyNode,
            expectOwnPropertyNode,
          );
          propComparisonMap.set(propName, ownPropertyComparison);
          return ownPropertyComparison;
        };
        const diffPropertyNameSet = new Set();
        const actualDiffIndexArray = [];
        const expectDiffIndexArray = [];
        for (const actualPropName of actualOwnPropertyNames) {
          const propComparison = getPropComparison(actualPropName);
          propComparisonMap.set(actualPropName, propComparison);
          if (propComparison.hasAnyDiff) {
            actualDiffIndexArray.push(
              actualOwnPropertyNames.indexOf(actualPropName),
            );
            expectDiffIndexArray.push(
              expectOwnPropertyNames.indexOf(actualPropName),
            );
            diffPropertyNameSet.add(actualPropName);
            if (diffPropertyNameSet.size === MAX_DIFF_PER_OBJECT) {
              break;
            }
          }
        }
        if (diffPropertyNameSet.size === 0) {
          actualNode.render = () =>
            renderPropertiesWithoutDiff(actualNode, {
              ownPropertyNodeMap: actualOwnPropertyNodeMap,
            });
          expectNode.render = () =>
            renderPropertiesWithoutDiff(expectNode, {
              ownPropertyNodeMap: expectOwnPropertyNodeMap,
            });
          return;
        }
        actualNode.render = () =>
          renderPropertiesDiff(actualNode, {
            indexToDisplayArray: getIndexToDisplayArray(
              actualDiffIndexArray.sort(),
              actualNode.ownPropertyNames,
            ),
            ownPropertyNodeMap: actualOwnPropertyNodeMap,
          });
        expectNode.render = () =>
          renderPropertiesDiff(expectNode, {
            indexToDisplayArray: getIndexToDisplayArray(
              expectDiffIndexArray.sort(),
              expectNode.ownPropertyNames,
            ),
            ownPropertyNodeMap: expectOwnPropertyNodeMap,
          });
        return;
      }
      if (actualNode.type === "own_property") {
        comparison.subcompare(
          actualNode.propertyNameNode,
          expectNode.propertyNameNode,
        );
        comparison.subcompare(
          actualNode.propertyValueNode,
          expectNode.propertyValueNode,
        );
        const renderPropertyDiff = (node) => {
          let propertyDiff = "";
          const propertyNameNode = node.propertyNameNode;
          propertyDiff += "  ".repeat(getNodeDepth(propertyNameNode));
          propertyDiff += propertyNameNode.render();
          propertyDiff += ":";
          propertyDiff += " ";
          const propertyValueNode = node.propertyValueNode;
          propertyDiff += propertyValueNode.render();
          propertyDiff += ",";
          return propertyDiff;
        };
        actualNode.render = () => renderPropertyDiff(actualNode);
        expectNode.render = () => renderPropertyDiff(expectNode);
        return;
      }
      throw new Error("wtf");
    };

    visit: {
      // comparing primitives
      if (actualNode.isPrimitive && expectNode.isPrimitive) {
        visitDuo();
        break visit;
      }
      // comparing composites
      if (actualNode.isComposite && expectNode.isComposite) {
        visitDuo();
        break visit;
      }
      // comparing own property (always compared together)
      if (actualNode.type === "own_property") {
        visitDuo();
        break visit;
      }
      // primitive vs composite
      if (actualNode.isPrimitive && expectNode.isComposite) {
        onSelfDiff("should_be_composite");
        visitSolo(actualNode);
        visitSolo(expectNode);
        break visit;
      }
      // composite vs primitive
      if (actualNode.isComposite && expectNode.isPrimitive) {
        onSelfDiff("should_be_primitive");
        visitSolo(actualNode);
        visitSolo(expectNode);
        break visit;
      }
      if (expectNode.placeholder) {
        visitSolo(actualNode);
        break visit;
      }
      if (actualNode.placeholder) {
        visitSolo(expectNode);
        break visit;
      }
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
  diff += startActualNode.render();
  diff += `\n`;
  diff += ANSI.color("expect:", sameColor);
  diff += " ";
  diff += startExpectNode.render();
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
      render: () => {},
    };

    if (value === PLACEHOLDER_FOR_NOTHING) {
      return node;
    }
    if (value === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
      return node;
    }
    if (type === "own_property") {
      return node;
    }
    if (type === "own_property_name") {
      node.isPrimitive = true;
      return node;
    }
    if (type === "own_property_symbol") {
      node.isPrimitive = true;
      node.isSymbol = true;
      return node;
    }
    if (typeof value === "object") {
      node.isComposite = true;
      node.valueStartDelimiter = "{";
      node.valueEndDelimiter = "}";

      const ownPropertyNames = [];
      for (const ownPropertyName of Object.getOwnPropertyNames(value)) {
        if (shouldIgnoreOwnPropertyName(node, ownPropertyName)) {
          continue;
        }
        ownPropertyNames.push(ownPropertyName);
      }
      node.ownPropertyNames = ownPropertyNames;

      return node;
    }

    node.isPrimitive = true;
    node.render = () => {
      return JSON.stringify(value);
    };
    return node;
  };
}

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
    value: node.value[ownPropertyName],
  });
  return ownPropertyNode;
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
    return (
      node.childNodes.wrappedValue &&
      node.childNodes.wrappedValue.key === "valueOf()"
    );
  }
  if (ownPropertyName === "toString") {
    return (
      node.childNodes.wrappedValue &&
      node.childNodes.wrappedValue.key === "toString()"
    );
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
