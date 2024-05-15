/*
 *
 */

import { ANSI } from "@jsenv/humanize";
import { allIterable } from "./iterable_helper.js";

const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectColor = ANSI.RED;
const expectColor = ANSI.GREEN;
const PLACEHOLDER_WHEN_ADDED_OR_REMOVED = { placeholder: true };
const PLACEHOLDER_WHEN_NULL = { placeholder: true };

export const assert = ({ actual, expect }) => {
  const rootActualNode = createNode({
    name: "actual",
    type: "root",
    depth: 0,
    value: actual,
  });
  const rootExpectNode = createNode({
    name: "expect",
    type: "root",
    depth: 0,
    value: expect,
  });

  const causeSet = new Set();
  const addCause = (comparison) => {
    causeSet.add(comparison);
  };

  const compare = (actualNode, expectNode) => {
    const ownPropertyComparisonMap = new Map();
    const comparison = {
      isComparison: true,
      actualDiff: "",
      expectDiff: "",
      actualNode,
      expectNode,
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
      ownPropertyComparisonMap,
    };

    let currentActualNode = actualNode;
    let currentExpectNode = expectNode;

    const appendDiff = (value) => {
      if (typeof value === "string") {
        if (!currentActualNode.placeholder) {
          comparison.actualDiff += value;
        }
        if (!currentExpectNode.placeholder) {
          comparison.expectDiff += value;
        }
        return;
      }
      if (Array.isArray(value)) {
        if (!currentActualNode.placeholder) {
          comparison.actualDiff += value[0];
        }
        if (!currentExpectNode.placeholder) {
          comparison.expectDiff += value[1];
        }
        return;
      }
      if (typeof value === "function") {
        const [actualColor, expectColor] = pickColors(
          currentActualNode,
          currentExpectNode,
          value,
        );
        if (!currentActualNode.placeholder) {
          comparison.actualDiff += ANSI.color(
            value(currentActualNode),
            actualColor,
          );
        }
        if (!currentExpectNode.placeholder) {
          comparison.expectDiff += ANSI.color(
            value(currentExpectNode),
            expectColor,
          );
        }
      }
      if (value && value.isComparison) {
        if (!currentActualNode.placeholder) {
          comparison.actualDiff += value.actualDiff;
        }
        if (!currentExpectNode.placeholder) {
          comparison.expectDiff += value.expectDiff;
        }
      }
    };

    const onAdded = (reason) => {
      comparison.reasons.self.added.add(reason);
      comparison.added = true;
    };
    const onRemoved = (reason) => {
      comparison.reasons.self.removed.add(reason);
      comparison.removed = true;
    };
    const onSelfDiff = (reason) => {
      comparison.reasons.self.modified.add(reason);
      if (comparison.reasons.self.modified.size === 1) {
        addCause(comparison);
      }
    };

    const comparePrimitive = () => {
      appendDiff((node) => JSON.stringify(node.value));
    };
    const compareComposite = () => {
      own_properties: {
        appendDiff((node) => node.valueStartDelimiter);

        const compareOwnProperty = (
          actualOwnPropertyNode,
          expectOwnPropertyNode,
        ) => {
          appendDiff("\n");
          const indent = "  ".repeat(
            actualOwnPropertyNode.depth || expectOwnPropertyNode.depth,
          );
          appendDiff(indent);
          const propertyKeyComparison = compare(
            createNode({
              type: "own_property_key",
              parent: actualOwnPropertyNode,
              value: actualOwnPropertyNode.key,
            }),
            createNode({
              type: "own_property_key",
              parent: actualOwnPropertyNode,
              value: expectOwnPropertyNode.key,
            }),
          );
          appendDiff(propertyKeyComparison);
          appendDiff((node) => node.propertyMiddleDelimiter);
          appendDiff(" ");
          const ownPropertyComparison = compare(
            actualOwnPropertyNode,
            expectOwnPropertyNode,
          );
          ownPropertyComparisonMap.set(
            actualOwnPropertyNode.key,
            ownPropertyComparison,
          );
          appendDiff(ownPropertyComparison);
          appendDiff((node) => node.propertyEndDelimiter);
        };
        for (let [actualOwnPropertyNode, expectOwnPropertyNode] of allIterable([
          getOwnPropertyNodeIterator(currentActualNode),
          getOwnPropertyNodeIterator(currentExpectNode),
        ])) {
          if (!actualOwnPropertyNode) {
            if (currentActualNode === PLACEHOLDER_WHEN_NULL) {
              actualOwnPropertyNode = PLACEHOLDER_WHEN_NULL;
            } else {
              actualOwnPropertyNode = PLACEHOLDER_WHEN_ADDED_OR_REMOVED;
              onRemoved(expectOwnPropertyNode);
            }
          } else if (!expectOwnPropertyNode) {
            if (currentExpectNode === PLACEHOLDER_WHEN_NULL) {
              expectOwnPropertyNode = PLACEHOLDER_WHEN_NULL;
            } else {
              expectOwnPropertyNode = PLACEHOLDER_WHEN_ADDED_OR_REMOVED;
              onAdded(actualOwnPropertyNode);
            }
          }
          compareOwnProperty(actualOwnPropertyNode, expectOwnPropertyNode);
        }
        appendDiff("\n");
        appendDiff((node) => node.valueEndDelimiter);
      }
    };
    const comparePropertyDescriptor = () => {
      for (let [
        actualOwnPropertyDescriptorNode,
        expectOwnPropertyDescriptorNode,
      ] of allIterable([
        getOwnPropertyDescriptorNodeIterator(currentActualNode),
        getOwnPropertyDescriptorNodeIterator(currentExpectNode),
      ])) {
        if (!actualOwnPropertyDescriptorNode) {
          if (currentActualNode === PLACEHOLDER_WHEN_NULL) {
            actualOwnPropertyDescriptorNode = PLACEHOLDER_WHEN_NULL;
          } else {
            actualOwnPropertyDescriptorNode = PLACEHOLDER_WHEN_ADDED_OR_REMOVED;
            onRemoved(expectOwnPropertyDescriptorNode);
          }
        } else if (!expectOwnPropertyDescriptorNode) {
          if (currentExpectNode === PLACEHOLDER_WHEN_NULL) {
            expectOwnPropertyDescriptorNode = PLACEHOLDER_WHEN_NULL;
          } else {
            expectOwnPropertyDescriptorNode = PLACEHOLDER_WHEN_ADDED_OR_REMOVED;
            onAdded(actualOwnPropertyDescriptorNode);
          }
        }
        const propertyDescriptorComparison = compare(
          actualOwnPropertyDescriptorNode,
          expectOwnPropertyDescriptorNode,
        );
        if (actualOwnPropertyDescriptorNode.key === "value") {
          const actualPropertyIsEnumerable =
            actualOwnPropertyDescriptorNode.parent.value.enumerable;
          const expectPropertyIsEnumerable =
            actualOwnPropertyDescriptorNode.parent.value.enumerable;
          if (
            !actualPropertyIsEnumerable &&
            !expectPropertyIsEnumerable &&
            !propertyDescriptorComparison.hasAnyDiff
          ) {
            // keep it hidden
          } else {
            appendDiff(propertyDescriptorComparison);
          }
        } else if (propertyDescriptorComparison.hasAnyDiff) {
          const descriptorKeyComparison = appendDiff(
            createNode({
              type: "descriptor_key",
              parent: actualOwnPropertyDescriptorNode,
              value: actualOwnPropertyDescriptorNode.key,
            }),
            createNode({
              type: "descriptor_key",
              parent: actualOwnPropertyDescriptorNode,
              value: actualOwnPropertyDescriptorNode.key,
            }),
          );
          appendDiff(descriptorKeyComparison);
          appendDiff(propertyDescriptorComparison);
        }
      }
    };
    const visitOne = (node) => {
      if (node.type === "own_property") {
        comparePropertyDescriptor();
      } else if (node.isComposite) {
        compareComposite();
      } else {
        comparePrimitive();
      }
    };

    visit: {
      // expect is removed or is expected to be missing
      if (
        expectNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED ||
        expectNode === PLACEHOLDER_WHEN_NULL
      ) {
        currentExpectNode = PLACEHOLDER_WHEN_NULL;
        visitOne(actualNode);
        currentExpectNode = expectNode;
        break visit;
      }
      // actual is added or expected to be missing
      if (
        actualNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED ||
        actualNode === PLACEHOLDER_WHEN_NULL
      ) {
        currentActualNode = PLACEHOLDER_WHEN_NULL;
        visitOne(expectNode);
        currentActualNode = actualNode;
        break visit;
      }
      // at this stage we are sure we got both actual and expect
      if (actualNode.type === "own_property") {
        comparePropertyDescriptor();
        break visit;
      }
      if (actualNode.isComposite && expectNode.isComposite) {
        if (actualNode.value === expectNode.value) {
          // we already know there will be no diff
          // but for now we'll still visit the composite constituents
        }
        compareComposite();
        break visit;
      }
      if (actualNode.isPrimitive && expectNode.isPrimitive) {
        if (actualNode.value === expectNode.value) {
          // we already know there will be no diff
          // but for now we'll still visit the primitive constituents
        } else {
          onSelfDiff("primitive_value");
        }
        comparePrimitive();
        break visit;
      }
      if (actualNode.isPrimitive && expectNode.isComposite) {
        onSelfDiff("should_be_composite");
        currentExpectNode = PLACEHOLDER_WHEN_NULL;
        comparePrimitive();
        currentExpectNode = expectNode;
        currentActualNode = PLACEHOLDER_WHEN_NULL;
        compareComposite();
        currentActualNode = actualNode;
        break visit;
      }
      if (actualNode.isComposite && expectNode.isPrimitive) {
        onSelfDiff("should_be_primitive");
        currentExpectNode = PLACEHOLDER_WHEN_NULL;
        compareComposite();
        currentExpectNode = expectNode;
        currentActualNode = PLACEHOLDER_WHEN_NULL;
        comparePrimitive();
        currentActualNode = actualNode;
        break visit;
      }
    }
    settleReasons(comparison);
    return comparison;
  };

  const rootComparison = compare(rootActualNode, rootExpectNode);
  if (!rootComparison.hasAnyDiff) {
    return;
  }

  let diff = ``;
  diff += ANSI.color("actual:", sameColor);
  diff += " ";
  diff += rootComparison.actualDiff;
  diff += `\n`;
  diff += ANSI.color("expect:", sameColor);
  diff += " ";
  diff += rootComparison.expectDiff;
  throw diff;
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
const appendReasons = (reasonSet, ...otherReasonSets) => {
  for (const otherReasonSet of otherReasonSets) {
    for (const reason of otherReasonSet) {
      reasonSet.add(reason);
    }
  }
};

const createNode = ({
  name,
  type,
  parent,
  depth = parent.depth,
  key,
  value,
}) => {
  if (name === undefined) name = parent.name;
  let isPrimitive = false;
  let isComposite = false;
  let valueStartDelimiter;
  let valueEndDelimiter;
  let propertyMiddleDelimiter;
  let propertyEndDelimiter;

  if (value === PLACEHOLDER_WHEN_NULL) {
  } else if (value === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
  } else if (type === "own_property") {
  } else if (typeof value === "object") {
    isComposite = true;
    valueStartDelimiter = "{";
    valueEndDelimiter = "}";
    propertyMiddleDelimiter = ":";
    propertyEndDelimiter = ",";
  } else {
    isPrimitive = true;
  }

  return {
    type,
    parent,
    depth,
    name,
    key,
    value,
    // info
    isPrimitive,
    isComposite,
    // render info
    valueStartDelimiter,
    valueEndDelimiter,
    propertyMiddleDelimiter,
    propertyEndDelimiter,
  };
};

function* getOwnPropertyNodeIterator(node) {
  if (node.placeholder) return;
  const ownPropertyNames = Object.getOwnPropertyNames(node.value);
  for (const ownPropertyName of ownPropertyNames) {
    const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(
      node.value,
      ownPropertyName,
    );
    ignore: {
      if (ownPropertyName === "prototype") {
        if (node.isFunction) {
          break ignore;
        }
        // ignore prototype if it's the default prototype
        // created by the runtime
        if (!Object.hasOwn(ownPropertyDescriptor, "value")) {
          break ignore;
        }
        const prototypeValue = ownPropertyDescriptor.value;
        if (node.isArrowFunction) {
          if (prototypeValue === undefined) {
            continue;
          }
          break ignore;
        }
        if (node.isAsyncFunction && !node.isGeneratorFunction) {
          if (prototypeValue === undefined) {
            continue;
          }
          break ignore;
        }
        const prototypeValueIsComposite = typeof prototypeValue === "object";
        if (!prototypeValueIsComposite) {
          break ignore;
        }
        const constructorDescriptor = Object.getOwnPropertyDescriptor(
          prototypeValue,
          "constructor",
        );
        if (!constructorDescriptor) {
          break ignore;
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
          break ignore;
        }
        const constructorValue = constructorDescriptor.value;
        if (constructorValue !== node.value) {
          break ignore;
        }
        const propertyNames = Object.getOwnPropertyNames(prototypeValue);
        if (propertyNames.length === 1) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "constructor") {
        // if (
        //   node.parent.key === "prototype" &&
        //   node.parent.parent.isFunction &&
        //   Object.hasOwn(ownPropertyDescriptor, "value") &&
        //   ownPropertyDescriptor.value === node.parent.parent.value
        // ) {
        continue;
        //  }
        //  break ignore;
      }
      if (ownPropertyName === "length") {
        if (node.canHaveIndexedValues || node.isFunction) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "name") {
        if (node.isFunction) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "stack") {
        if (node.isError) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "valueOf") {
        if (
          node.childNodes.wrappedValue &&
          node.childNodes.wrappedValue.key === "valueOf()"
        ) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "toString") {
        if (
          node.childNodes.wrappedValue &&
          node.childNodes.wrappedValue.key === "toString()"
        ) {
          continue;
        }
        break ignore;
      }
    }
    yield createNode({
      type: "own_property",
      parent: node,
      depth: node.depth + 1,
      key: ownPropertyName,
      value: ownPropertyDescriptor,
    });
  }
}
function* getOwnPropertyDescriptorNodeIterator(ownPropertyNode) {
  if (ownPropertyNode.placeholder) return;
  for (const descriptorKey of [
    "value",
    "enumerable",
    "configurable",
    "writable",
    "get",
    "set",
  ]) {
    const compositeNode = ownPropertyNode.parent;
    const ownPropertyDescriptor = ownPropertyNode.value;
    if (!Object.hasOwn(ownPropertyDescriptor, descriptorKey)) {
      continue;
    }
    const descriptorValue = ownPropertyDescriptor[descriptorKey];
    ignore: {
      /* eslint-disable no-unneeded-ternary */
      if (descriptorKey === "writable") {
        if (compositeNode.propsFrozen) {
          continue;
        }
        const writableDefaultValue =
          ownPropertyNode.key.value === "prototype" && compositeNode.isClass
            ? false
            : true;
        if (descriptorValue === writableDefaultValue) {
          continue;
        }
        break ignore;
      }
      if (descriptorKey === "configurable") {
        if (compositeNode.propsFrozen) {
          continue;
        }
        if (compositeNode.propsSealed) {
          continue;
        }
        const configurableDefaultValue =
          ownPropertyNode.key.value === "prototype" && compositeNode.isFunction
            ? false
            : true;
        if (descriptorValue === configurableDefaultValue) {
          continue;
        }
        break ignore;
      }
      if (descriptorKey === "enumerable") {
        const enumerableDefaultValue =
          (ownPropertyNode.key.value === "prototype" &&
            compositeNode.isFunction) ||
          (ownPropertyNode.key.value === "message" && compositeNode.isError) ||
          compositeNode.isClassPrototype
            ? false
            : true;
        if (descriptorValue === enumerableDefaultValue) {
          continue;
        }
        break ignore;
      }
      /* eslint-enable no-unneeded-ternary */
      if (descriptorKey === "get") {
        if (descriptorValue === undefined) {
          continue;
        }
        break ignore;
      }
      if (descriptorKey === "set") {
        if (descriptorValue === undefined) {
          continue;
        }
        break ignore;
      }
    }
    yield createNode({
      type: "own_property_descriptor",
      parent: ownPropertyNode,
      key: descriptorKey,
      value: descriptorValue,
    });
  }
}

const pickColors = (actualNode, expectNode, getter) => {
  if (actualNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
    return [addedColor, null];
  }
  if (expectNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
    return [removedColor, null];
  }
  if (actualNode && expectNode === PLACEHOLDER_WHEN_NULL) {
    return [unexpectColor, null];
  }
  if (expectNode && actualNode === PLACEHOLDER_WHEN_NULL) {
    return [null, expectColor];
  }
  const actualValue = getter(actualNode);
  const expectValue = getter(expectNode);
  if (actualValue === expectValue) {
    return [sameColor, sameColor];
  }
  return [unexpectColor, expectColor];
};
